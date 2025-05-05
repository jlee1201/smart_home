import axios from 'axios';
import crypto from 'crypto';
import https from 'node:https';
import { logger } from './logger.js';

// Type definitions for Vizio API
export type VizioTVConfig = {
  ip: string;
  port?: number;
  authToken?: string;
  deviceId?: string;
  deviceName?: string;
};

export type VizioCommandPayload = {
  KEYLIST?: string[];
  ITEMS?: Array<{
    NAME?: string;
    VALUE?: string | number;
    HASHVAL?: string;
  }>;
};

export class VizioAPI {
  private ip: string;
  private port: number;
  private authToken: string | null;
  private deviceId: string;
  private deviceName: string;
  private pairingToken: number | null = null;
  
  constructor(config: VizioTVConfig) {
    this.ip = config.ip;
    this.port = config.port || 7345; // Default Vizio SmartCast port
    this.authToken = config.authToken || null;
    this.deviceId = config.deviceId || crypto.randomUUID();
    this.deviceName = config.deviceName || 'SmartHome Controller';
    this.pairingToken = null;
  }
  
  private getBaseUrl(): string {
    return `https://${this.ip}:${this.port}`;
  }
  
  private async sendRequest(
    endpoint: string, 
    method: string = 'GET', 
    data: any = null, 
    requiresAuth: boolean = true,
    retryCount = 2
  ): Promise<any> {
    try {
      const url = `${this.getBaseUrl()}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (requiresAuth && this.authToken) {
        // The Vizio API is picky about header format - there should be no space after the colon
        // and the header name should be 'AUTH' not 'Authorization'
        headers['AUTH'] = this.authToken;
        logger.debug(`Using auth token for request: ${this.authToken.substring(0, 5)}...`);
      }
      
      logger.info(`Sending ${method} request to ${url}`);
      
      // Log the request data for debugging (redact sensitive info)
      if (data) {
        const logData = { ...data };
        if (logData.RESPONSE_VALUE) {
          logData.RESPONSE_VALUE = '****'; // Don't log the PIN
        }
        logger.debug('Request data:', { data: logData });
      }
      
      // Special handling for different endpoints
      let requestData: any;
      
      // For key_command endpoint, don't use the data wrapper
      if (endpoint === '/key_command/') {
        requestData = data;
      } 
      // For menu_native endpoints, use a specific format
      else if (endpoint.startsWith('/menu_native/')) {
        // The Vizio M65Q7-H1 expects a specific format for menu_native PUT requests
        if (method === 'PUT') {
          requestData = data;
        } else {
          requestData = data ? { data } : undefined;
        }
      }
      // For all other endpoints, use the data wrapper as needed by the Vizio API
      else {
        requestData = data ? { data } : undefined;
      }
      
      const response = await axios({
        method,
        url,
        headers,
        data: requestData,
        // Skip SSL certificate verification for local network devices
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        // Add a timeout to prevent hanging requests
        timeout: 10000, // 10 seconds
      });
      
      return response.data && response.data.response ? response.data.response : response.data;
    } catch (error) {
      const typedError = error as any;
      
      // Check for server error (500)
      if (typedError?.response?.status === 500) {
        // Enhanced 500 error logging
        logger.warn(`Received 500 error from TV for ${method} request to ${endpoint}`, {
          status: typedError?.response?.status,
          data: typedError?.response?.data,
          errorSource: 'VizioTV',
          requestDetails: {
            method,
            endpoint,
            dataType: data ? typeof data : 'null',
            dataPreview: data ? JSON.stringify(data).substring(0, 100) : 'null'
          }
        });
        
        // Also log to the error log channel if pubsub is available
        try {
          // We need to import the function at the top of the file
          const { addErrorToLog } = await import('../resolvers.js');
          const pubsub = (global as any).pubsub;
          if (pubsub && addErrorToLog) {
            await addErrorToLog(
              pubsub, 
              `500 error from Vizio TV: ${endpoint}`,
              JSON.stringify({
                method,
                endpoint,
                status: typedError?.response?.status,
                data: typedError?.response?.data,
                requestDetails: {
                  dataPreview: data ? JSON.stringify(data).substring(0, 100) : 'null'
                }
              })
            );
          }
        } catch (logError) {
          logger.debug('Could not add to error log channel', { logError });
        }
        
        // Retry with exponential backoff
        if (retryCount > 0) {
          const delay = (3 - retryCount) * 1000; // 1s, 2s, 3s...
          logger.info(`Retrying ${method} request to ${endpoint} after ${delay}ms. Attempts remaining: ${retryCount}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.sendRequest(endpoint, method, data, requiresAuth, retryCount - 1);
        } else {
          // Log when all retries are exhausted
          logger.error(`All retries failed for ${method} request to ${endpoint} - 500 errors persisted`);
        }
      }
      
      // Only log request details for unexpected errors
      const isAuthError = 
        typedError?.response?.status === 400 || 
        typedError?.response?.status === 401 || 
        typedError?.response?.status === 403;
      
      // Use warn level instead of error for most connection issues
      if (isAuthError) {
        logger.warn('TV API authentication error', { 
          status: typedError?.response?.status,
          endpoint,
          method
        });
      } else {
        logger.warn('Error communicating with Vizio TV', { 
          error: typedError?.message || 'Unknown error',
          endpoint,
          method,
          requiresAuth
        });
        
        // Only log detailed request info for non-auth errors and in development
        if (process.env.NODE_ENV !== 'production') {
          logger.debug('Failed request details:', {
            url: `${this.getBaseUrl()}${endpoint}`,
            method,
            headers: requiresAuth ? { 'AUTH': this.authToken ? `${this.authToken.substring(0, 5)}...` : 'null' } : {},
            data: data ? JSON.stringify(data).substring(0, 100) : null
          });
        }
      }
      
      // Check for common error conditions
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status;
          const responseData = error.response.data || {};
          
          // Only log response data in detail for unexpected errors
          if (!isAuthError) {
            logger.debug('TV API response error', { 
              status,
              data: typeof responseData === 'string' ? responseData.substring(0, 100) : responseData,
              headers: error.response.headers
            });
          }
          
          // Check for authentication errors
          if (status === 401 || status === 403) {
            throw new Error(`Vizio API authentication error: ${status} - Please re-pair with TV`);
          }
          
          // For 400 errors, format error message based on response data
          if (status === 400) {
            if (responseData && typeof responseData === 'object' && 'STATUS' in responseData && 
                responseData.STATUS && typeof responseData.STATUS === 'object' && 'DETAIL' in responseData.STATUS) {
              throw new Error(`Vizio API error: ${status} - ${responseData.STATUS.DETAIL}`);
            }
            throw new Error(`Vizio API error: ${status} Bad Request - Check input format`);
          }
          
          throw new Error(`Vizio API error: ${status} ${JSON.stringify(responseData).substring(0, 100)}`);
        } else if (error.request) {
          throw new Error(`Vizio TV connection error: No response received (TV might be off or unreachable)`);
        }
      }
      throw new Error(`Vizio API error: ${typedError?.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Initiate the pairing process
   * This returns a challenge code that the user needs to enter on their TV
   */
  async initiatePairing(): Promise<string> {
    // First, try to cancel any existing pairing sessions
    await this.cancelPairing();
    
    const data = {
      DEVICE_ID: this.deviceId,
      DEVICE_NAME: this.deviceName,
      CHALLENGE_TYPE: 1, // PIN code
    };
    
    try {
      const response = await this.sendRequest('/pairing/start', 'PUT', data, false) as any;
      logger.info('Vizio TV pairing initiation response:', { response });
      
      // Store the pairing request token for later use
      if (response && typeof response === 'object' && 'ITEM' in response && 
          response.ITEM && typeof response.ITEM === 'object' && 'PAIRING_REQ_TOKEN' in response.ITEM) {
        this.pairingToken = response.ITEM.PAIRING_REQ_TOKEN;
        logger.info(`Stored pairing request token: ${this.pairingToken}`);
      } else {
        logger.warn('No pairing request token found in the response');
        this.pairingToken = null;
      }
      
      // Check if we received a BLOCKED status
      if (response && typeof response === 'object' && 'STATUS' in response && 
          response.STATUS && typeof response.STATUS === 'object' && 'RESULT' in response.STATUS &&
          response.STATUS.RESULT === "BLOCKED") {
        logger.info('Received BLOCKED status from TV for pairing initiation');
        
        // For this TV model, BLOCKED status often means the PIN is actually displayed
        // Skip the retry logic and immediately return PIN_ON_SCREEN
        logger.info('Vizio TV returned BLOCKED status, but PIN is likely displayed on TV screen');
        return "PIN_ON_SCREEN";
      }
      
      if (response && typeof response === 'object' && 'ITEM' in response && 
          response.ITEM && typeof response.ITEM === 'object' && 'CHALLENGE_KEY' in response.ITEM) {
        return response.ITEM.CHALLENGE_KEY;
      }

      // For success responses without a challenge key, the PIN should be displayed on TV
      if (response && typeof response === 'object' && 'STATUS' in response && 
          response.STATUS && typeof response.STATUS === 'object' && 'RESULT' in response.STATUS &&
          response.STATUS.RESULT === "SUCCESS") {
        logger.info('Received SUCCESS response but no challenge key, PIN likely on screen');
        return "PIN_ON_SCREEN";
      }
      
      throw new Error('Failed to initiate pairing with TV: Invalid response format');
    } catch (error) {
      const typedError = error as any;
      logger.warn('Error during TV pairing initiation', { 
        error: {
          message: typedError?.message || 'Unknown error',
          stack: typedError?.stack || 'No stack trace',
          name: typedError?.name || 'Unknown error type',
          code: typedError?.code,
          status: typedError?.status,
          response: typedError?.response || 'No response data'
        } 
      });
      
      // If we received a specific error about being blocked, PIN is likely on screen
      if (typedError?.message && typedError.message.includes('BLOCKED')) {
        logger.info('Error contains BLOCKED status, PIN is likely on screen regardless');
        return "PIN_ON_SCREEN";
      }
      
      throw error;
    }
  }
  
  /**
   * Complete the pairing using the PIN displayed on the TV
   */
  async completePairing(pin: string): Promise<string> {
    const data: any = {
      DEVICE_ID: this.deviceId,
      CHALLENGE_TYPE: 1,
      RESPONSE_VALUE: pin,
    };
    
    // Include pairing request token if available
    if (this.pairingToken !== null) {
      data.PAIRING_REQ_TOKEN = this.pairingToken;
      logger.info(`Including pairing request token: ${this.pairingToken}`);
    } else {
      logger.warn('No pairing request token available for completePairing');
    }
    
    try {
      const response = await this.sendRequest('/pairing/pair', 'PUT', data, false);
      logger.info('Vizio TV pairing completion response:', { response });
      
      // Check for error conditions that indicate PIN rejection
      if (response && response.STATUS) {
        if (response.STATUS.RESULT === "BLOCKED") {
          throw new Error('INVALID_PIN: The pairing was blocked by the TV.');
        }
        
        if (response.STATUS.RESULT === "DENIED" || 
            response.STATUS.RESULT === "CHALLENGE_INCORRECT" ||
            response.STATUS.RESULT === "INVALID_PIN") {
          throw new Error('INVALID_PIN: The PIN entered was incorrect.');
        }
        
        if (response.STATUS.RESULT === "INVALID_PARAMETER") {
          throw new Error('INVALID_PARAMETER: Missing or incorrect pairing parameters. Please restart the pairing process.');
        }
      }
      
      // Check for a valid auth token
      if (response && response.ITEM && response.ITEM.AUTH_TOKEN) {
        // Store the auth token properly
        this.authToken = response.ITEM.AUTH_TOKEN;
        this.pairingToken = null; // Clear the pairing token as it's no longer needed
        
        // Return the auth token for storage elsewhere
        const authToken = response.ITEM.AUTH_TOKEN;
        logger.info(`Received valid auth token: ${authToken.substring(0, 5)}... (${authToken.length} chars)`);
        return authToken;
      }
      
      throw new Error('Failed to complete pairing with TV: No auth token in response');
    } catch (error) {
      const typedError = error as any;
      logger.error('Error during TV pairing completion', { 
        error: {
          message: typedError?.message || 'Unknown error',
          stack: typedError?.stack || 'No stack trace',
          name: typedError?.name || 'Unknown error type', 
          code: typedError?.code,
          status: typedError?.status,
          response: typedError?.response || 'No response'
        }
      });
      
      // Check for auth failure errors (bad PIN)
      if (typedError?.response?.status === 403 || 
          (typedError?.message && (
            typedError.message.includes('403') || 
            typedError.message.includes('Invalid PIN') || 
            typedError.message.includes('CHALLENGE_INCORRECT')
          ))
      ) {
        throw new Error('Invalid PIN: The TV rejected the PIN you entered. Try again with the correct PIN.');
      }
      
      throw error;
    }
  }
  
  /**
   * Get current power state
   */
  async getPowerState(): Promise<boolean> {
    try {
      const response = await this.sendRequest('/state/device/power_mode');
      logger.info('Power state response:', { response });
      
      // Handle different possible response formats
      if (response && response.ITEMS && response.ITEMS.length > 0) {
        return response.ITEMS[0].VALUE === 1;
      } else if (response && response.item && response.item.VALUE !== undefined) {
        return response.item.VALUE === 1;
      }
      
      // If we can't determine power state but we received a response, assume TV is on
      // This helps with some Vizio models that don't properly report power state
      if (response) {
        logger.info('Could not determine power state from response, assuming TV is on');
        return true;
      }
      
      return false;
    } catch (error) {
      // If we get a response error, the TV is likely on (since it responded)
      logger.info('Error getting power state, assuming TV is on since it responded to API call');
      return true;
    }
  }
  
  /**
   * Toggle power (turn on/off)
   */
  async togglePower(): Promise<void> {
    await this.sendKeyPress('POWER');
  }
  
  /**
   * Get current volume level
   */
  async getVolume(): Promise<number> {
    const response = await this.sendRequest('/menu_native/dynamic/tv_settings/audio/volume');
    logger.debug('Volume response:', { response });
    
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE as number;
    } else if (response && response.item && response.item.VALUE !== undefined) {
      return response.item.VALUE as number;
    } else if (response && response.items && response.items.length > 0) {
      return response.items[0].value as number;
    }
    
    logger.warn('Could not determine volume from response');
    return 0;
  }
  
  /**
   * Set volume level
   */
  async setVolume(level: number): Promise<void> {
    const volume = Math.max(0, Math.min(100, level));
    const data = {
      REQUEST: "MODIFY",
      ITEMS: [{
        NAME: "VOLUME",
        VALUE: volume
      }]
    };
    
    await this.sendRequest('/menu_native/dynamic/tv_settings/audio/volume', 'PUT', data);
  }
  
  /**
   * Get mute status
   */
  async getMuteState(): Promise<boolean> {
    const response = await this.sendRequest('/menu_native/dynamic/tv_settings/audio/mute');
    logger.debug('Mute state response:', { response });
    
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE === 1;
    } else if (response && response.item && response.item.VALUE !== undefined) {
      return response.item.VALUE === 1;
    } else if (response && response.items && response.items.length > 0) {
      return response.items[0].value === 1;
    }
    
    logger.warn('Could not determine mute state from response');
    return false;
  }
  
  /**
   * Toggle mute
   */
  async toggleMute(): Promise<void> {
    await this.sendKeyPress('MUTE');
  }
  
  /**
   * Get current input
   */
  async getCurrentInput(): Promise<string> {
    const response = await this.sendRequest('/menu_native/dynamic/tv_settings/devices/current_input');
    logger.debug('Current input response:', { response });
    
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE as string;
    } else if (response && response.item && response.item.VALUE !== undefined) {
      return response.item.VALUE as string;
    } else if (response && response.items && response.items.length > 0 && response.items[0].value) {
      return response.items[0].value as string;
    }
    
    logger.warn('Could not determine current input from response');
    return '';
  }
  
  /**
   * Set input
   */
  async setInput(input: string): Promise<void> {
    // Normalize input name for consistency
    let normalizedInput = input;
    
    // For M65Q7-H1 model, inputs need specific formatting
    // Possible input values: HDMI-1, HDMI-2, HDMI-3, HDMI-4, TV, COMP, AV, SMARTCAST
    if (input.includes('_')) {
      normalizedInput = input.replace(/_/g, '-');
    }
    
    // If the input is just HDMI without a number, default to HDMI-1
    if (normalizedInput === 'HDMI') {
      normalizedInput = 'HDMI-1';
    }
    
    // For this model, input names need to be uppercase
    normalizedInput = normalizedInput.toUpperCase();
    
    // Try using the direct MODIFY request first
    try {
      const data = {
        REQUEST: "MODIFY",
        ITEMS: [{
          NAME: "CURRENT_INPUT",
          VALUE: normalizedInput
        }]
      };
      
      // Increased retry count from 1 to 3 for this specific endpoint which commonly returns 500 errors
      await this.sendRequest('/menu_native/dynamic/tv_settings/devices/current_input', 'PUT', data, true, 3);
      logger.info(`Input set to ${normalizedInput} successfully via MODIFY`);
      return;
    } catch (error) {
      logger.warn(`Error setting input using MODIFY method for input ${normalizedInput}`, { 
        error: error instanceof Error ? error.message : String(error),
        // Log more details about the error for debugging
        errorDetails: {
          name: error instanceof Error ? error.name : 'Unknown',
          statusCode: (error as any)?.response?.status || 'Unknown status'
        }
      });
      
      // If MODIFY fails, try using a keypress sequence for common inputs
      // This is a fallback for when the direct method returns 500 errors
      try {
        switch (normalizedInput) {
          case 'HDMI-1':
          case 'HDMI1':
            logger.info('Trying input change via key sequence for HDMI-1');
            await this.sendKeyPress('INPUT_HDMI1');
            return;
            
          case 'HDMI-2':
          case 'HDMI2':
            logger.info('Trying input change via key sequence for HDMI-2');
            await this.sendKeyPress('INPUT_HDMI2');
            return;
            
          case 'HDMI-3':
          case 'HDMI3':
            logger.info('Trying input change via key sequence for HDMI-3');
            await this.sendKeyPress('INPUT_HDMI3');
            return;
            
          case 'HDMI-4':
          case 'HDMI4':
            logger.info('Trying input change via key sequence for HDMI-4');
            await this.sendKeyPress('INPUT_HDMI4');
            return;
            
          case 'SMARTCAST':
            logger.info('Trying input change via key sequence for SMARTCAST');
            await this.sendKeyPress('SMARTCAST');
            return;
            
          default:
            // If we can't use a direct key, try one more approach
            logger.info(`No direct key for ${normalizedInput}, trying alternative approach`);
            break;
        }
        
        // Last resort: try using a different input switching endpoint
        const altData = {
          DEVICE_NAME: this.deviceName,
          DEVICE_ID: this.deviceId,
          INPUT_NAME: normalizedInput
        };
        
        await this.sendRequest('/menu_native/dynamic/tv_settings/devices/current_input/NAME', 'PUT', altData);
        logger.info(`Input set to ${normalizedInput} successfully via alternative method`);
        
      } catch (secondError) {
        logger.error(`Failed to set input after multiple attempts for input ${normalizedInput}`, {
          error: secondError instanceof Error ? secondError.message : String(secondError)
        });
        throw new Error(`Failed to set TV input to ${normalizedInput} after multiple attempts`);
      }
    }
  }
  
  /**
   * Change channel (for TV input)
   */
  async setChannel(channel: string): Promise<void> {
    for (const digit of channel) {
      await this.sendKeyPress(`NUM_${digit}`);
      // Add delay between key presses
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Send ENTER to confirm channel change
    await this.sendKeyPress('ENTER');
  }
  
  /**
   * Send remote key press
   */
  async sendKeyPress(key: string, retryCount = 2): Promise<void> {
    // Special codesets for M65Q7-H1 model
    // Different keys need different CODESET values
    const KEY_CODESET_MAP: Record<string, number> = {
      'BACK': 4,       // Navigation keys use CODESET 4
      'UP': 4,
      'DOWN': 4,
      'LEFT': 4,
      'RIGHT': 4,
      'OK': 4,
      'HOME': 4,
      'MENU': 4,
      'EXIT': 4,
      'POWER': 3,      // Power uses CODESET 3
      'VOL_UP': 5,     // Volume keys use CODESET 5
      'VOL_DOWN': 5,
      'MUTE': 5,
      'CH_UP': 8,      // Channel keys use CODESET 8
      'CH_DOWN': 8
    };
    
    // Multiple formats to try for this TV model - FIXED: removed data wrapper
    // since sendRequest doesn't wrap data for key_command/ endpoint
    const formats = [
      // Format 1: Standard KEYLIST format
      { KEYLIST: [key] },
      
      // Format 2: CODESET format with the right codeset for the key
      { CODESET: KEY_CODESET_MAP[key] || 5, CODE: key, ACTION: "KEYPRESS" },
      
      // Format 3: Single key format
      { key: key },
      
      // Format 4: Alternative key format with KEY instead of key
      { KEY: key }
    ];
    
    // Some keys need special mapping for M65Q7-H1 model
    const specialKeys: Record<string, string> = {
      'VOLUME_UP': 'VOL_UP',
      'VOLUME_DOWN': 'VOL_DOWN',
      'CHANNEL_UP': 'CH_UP',
      'CHANNEL_DOWN': 'CH_DOWN',
      'INPUT_HDMI1': 'INPUT_HDMI_1',
      'INPUT_HDMI2': 'INPUT_HDMI_2',
      'INPUT_HDMI3': 'INPUT_HDMI_3',
      'INPUT_HDMI4': 'INPUT_HDMI_4'
    };
    
    // Apply special key mapping if needed
    const actualKey = specialKeys[key] || key;
    
    let lastError: any = null;
    
    // Try each format with decreasing delay between attempts
    for (let i = 0; i < formats.length; i++) {
      try {
        // Clone the format to avoid modifying the original
        const formatData = JSON.parse(JSON.stringify(formats[i]));
        
        // Update the key in the format
        if (formatData.KEYLIST) {
          formatData.KEYLIST = [actualKey];
        } else if (formatData.CODE) {
          formatData.CODE = actualKey;
          // Use the appropriate CODESET for this key if available
          if (KEY_CODESET_MAP[actualKey]) {
            formatData.CODESET = KEY_CODESET_MAP[actualKey];
          }
        } else if (formatData.key) {
          formatData.key = actualKey;
        } else if (formatData.KEY) {
          formatData.KEY = actualKey;
        }
        
        // Make the request with the current format
        const response = await this.sendRequest('/key_command/', 'PUT', formatData);
        
        // Check if the response contains an error
        if (response && response.STATUS && response.STATUS.RESULT !== "SUCCESS") {
          logger.warn(`Key press ${key} returned error: ${response.STATUS.DETAIL || response.STATUS.RESULT} with format ${i+1}`);
          // Don't throw here, try next format
        } else {
          logger.info(`Key press ${key} sent successfully with format ${i+1}`, { response });
          return; // Success, exit function
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Error sending key press ${key} with format ${i+1}`, { 
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Don't retry immediately, wait a bit (increasing delay for each format)
        await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
      }
    }
    
    // If all formats failed and we still have retries left
    if (retryCount > 0) {
      logger.info(`Retrying key press ${key} with all formats, ${retryCount} attempts remaining`);
      // Add a longer delay before full retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.sendKeyPress(key, retryCount - 1);
    }
    
    // If we've run out of retries, don't throw - this allows the UI to continue working
    // even if some commands fail
    logger.warn(`Key press ${key} failed after all formats and retries`, {
      error: lastError instanceof Error ? lastError.message : String(lastError)
    });
  }
  
  /**
   * Launch a smart app
   */
  async launchApp(appName: string): Promise<void> {
    const data = {
      REQUEST: "LAUNCH",
      VALUE: {
        NAME: appName
      }
    };
    
    try {
      await this.sendRequest('/app/launch', 'PUT', data);
      logger.info(`App ${appName} launched successfully`);
    } catch (error) {
      logger.error(`Error launching app ${appName}`, { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Cancel any existing pairing sessions
   * This should be called before initiating a new pairing session
   */
  async cancelPairing(): Promise<boolean> {
    try {
      // The /pairing/cancel endpoint is used to cancel any ongoing pairing
      const data = {
        DEVICE_ID: this.deviceId,
        CHALLENGE_TYPE: 1,
        RESPONSE_VALUE: "1111",
        PAIRING_REQ_TOKEN: 0
      };
      
      const response = await this.sendRequest('/pairing/cancel', 'PUT', data, false);
      logger.info('Pairing cancellation response:', { response });
      
      // Wait longer for the TV to process the cancellation
      logger.info('Waiting for TV to fully clear pairing state...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return true;
    } catch (error) {
      // Ignore errors from cancellation - it's not critical if it fails
      // (The TV might not have an active pairing session)
      logger.info('Pairing cancellation attempt result:', { error });
      return false;
    }
  }
  
  /**
   * Get list of available inputs
   */
  async getAvailableInputs(): Promise<string[]> {
    try {
      const response = await this.sendRequest('/menu_native/dynamic/tv_settings/devices/name_input');
      logger.debug('Available inputs response:', { response });
      
      // Extract input names from response
      const inputs: string[] = [];
      
      if (response && response.ITEMS && Array.isArray(response.ITEMS)) {
        // Extract inputs from standard format
        for (const item of response.ITEMS) {
          if (item && item.NAME && item.NAME !== "Name Input" && item.VALUE !== undefined) {
            inputs.push(item.NAME);
          }
        }
      } else if (response && response.items && Array.isArray(response.items)) {
        // Extract inputs from alternative format
        for (const item of response.items) {
          if (item && item.name && item.name !== "Name Input" && item.value !== undefined) {
            inputs.push(item.name);
          }
        }
      }
      
      // If we couldn't get any inputs from the API, return default inputs for this model
      if (inputs.length === 0) {
        return ['HDMI-1', 'HDMI-2', 'HDMI-3', 'HDMI-4', 'TV', 'COMP', 'AV', 'SMARTCAST'];
      }
      
      return inputs;
    } catch (error) {
      logger.warn('Error getting available inputs', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default inputs for this model if the request fails
      return ['HDMI-1', 'HDMI-2', 'HDMI-3', 'HDMI-4', 'TV', 'COMP', 'AV', 'SMARTCAST'];
    }
  }
}

// Helper function to create VizioAPI instance from environment variables
export function createVizioAPIFromEnv(): VizioAPI {
  const ip = process.env.VIZIO_TV_IP;
  const authToken = process.env.VIZIO_AUTH_TOKEN;
  
  if (!ip) {
    throw new Error('VIZIO_TV_IP environment variable must be set');
  }
  
  return new VizioAPI({
    ip,
    authToken: authToken || undefined,
    port: parseInt(process.env.VIZIO_TV_PORT || '7345', 10),
    deviceName: process.env.VIZIO_DEVICE_NAME || 'SmartHome Controller'
  });
}

// Helper function to create VizioAPI instance from database settings
export async function createVizioAPIFromDB(dbSettings: any): Promise<VizioAPI> {
  if (!dbSettings || !dbSettings.ip) {
    throw new Error('TV settings not found in database');
  }
  
  return new VizioAPI({
    ip: dbSettings.ip,
    authToken: dbSettings.authToken || undefined,
    port: dbSettings.port || 7345,
    deviceId: dbSettings.deviceId,
    deviceName: dbSettings.deviceName || 'SmartHome Controller'
  });
}

// Map of command names to Vizio API key codes
export const VIZIO_COMMANDS = {
  POWER: 'POWER',
  VOLUME_UP: 'VOL_UP',
  VOLUME_DOWN: 'VOL_DOWN',
  MUTE: 'MUTE',
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  OK: 'OK',
  BACK: 'BACK',
  HOME: 'HOME',
  MENU: 'MENU',
  EXIT: 'EXIT',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  STOP: 'STOP',
  REWIND: 'REW',
  FAST_FORWARD: 'FWD',
  GUIDE: 'GUIDE',
  INFO: 'INFO',
  CHANNEL_UP: 'CH_UP',
  CHANNEL_DOWN: 'CH_DOWN',
}; 