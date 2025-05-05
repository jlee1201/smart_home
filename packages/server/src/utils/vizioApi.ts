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
                request: {
                  method,
                  url: `${this.getBaseUrl()}${endpoint}`,
                  data: data ? JSON.stringify(data, null, 2) : null
                },
                response: {
                  status: typedError?.response?.status,
                  data: typedError?.response?.data ? JSON.stringify(typedError?.response?.data, null, 2) : null
                }
              }, null, 2)
            );
          }
        } catch (logError) {
          logger.debug('Could not add to error log channel', { logError });
        }
        
        // For PUT requests to key_command endpoint, don't retry on 500 errors
        if (method === 'PUT' && endpoint === '/key_command/') {
          logger.warn('Not retrying PUT request to /key_command/ after 500 error');
          throw new Error(`TV remote command failed: Server error (500)`);
        }
        
        // Retry with exponential backoff for other requests
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
          
          // Add detailed request and response to error log
          try {
            const { addErrorToLog } = await import('../resolvers.js');
            const pubsub = (global as any).pubsub;
            if (pubsub && addErrorToLog) {
              await addErrorToLog(
                pubsub, 
                `Vizio API error: ${status} - ${endpoint}`,
                JSON.stringify({
                  request: {
                    method,
                    url: `${this.getBaseUrl()}${endpoint}`,
                    data: data ? JSON.stringify(data, null, 2) : null
                  },
                  response: {
                    status,
                    data: typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData
                  }
                }, null, 2)
              );
            }
          } catch (logError) {
            logger.debug('Could not add to error log channel', { logError });
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
    
    try {
      // First fetch current volume settings to get the hashval
      const currentVolumeResponse = await this.sendRequest('/menu_native/dynamic/tv_settings/audio/volume');
      logger.debug('Current volume settings:', { currentVolumeResponse });
      
      if (!currentVolumeResponse || !currentVolumeResponse.ITEMS || !currentVolumeResponse.ITEMS.length) {
        throw new Error('Failed to retrieve current volume settings');
      }
      
      // Find the volume item to get its hashval
      const volumeItem = currentVolumeResponse.ITEMS.find((item: any) => 
        item.NAME === "Volume" || item.CNAME === "volume"
      );
      
      if (!volumeItem || !volumeItem.HASHVAL) {
        throw new Error('Could not find volume HASHVAL in response');
      }
      
      const hashVal = volumeItem.HASHVAL;
      logger.debug(`Found volume HASHVAL: ${hashVal}`);
      
      // Now send the properly formatted PUT request
      const data = {
        REQUEST: "MODIFY",
        VALUE: volume,
        HASHVAL: hashVal
      };
      
      const response = await this.sendRequest('/menu_native/dynamic/tv_settings/audio/volume', 'PUT', data);
      logger.info(`Volume set to ${volume} successfully`, { response });
    } catch (error) {
      logger.error(`Failed to set volume to ${volume}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to set TV volume to ${volume}`);
    }
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
    
    // First try using key press commands which work more reliably
    try {
      // Use a keypress sequence for common inputs
      switch (normalizedInput) {
        case 'HDMI-1':
        case 'HDMI1':
          logger.info('Setting input to HDMI-1 via key sequence');
          await this.sendKeyPress('INPUT_HDMI1');
          return;
          
        case 'HDMI-2':
        case 'HDMI2':
          logger.info('Setting input to HDMI-2 via key sequence');
          await this.sendKeyPress('INPUT_HDMI2');
          return;
          
        case 'HDMI-3':
        case 'HDMI3':
          logger.info('Setting input to HDMI-3 via key sequence');
          await this.sendKeyPress('INPUT_HDMI3');
          return;
          
        case 'HDMI-4':
        case 'HDMI4':
          logger.info('Setting input to HDMI-4 via key sequence');
          await this.sendKeyPress('INPUT_HDMI4');
          return;
          
        case 'SMARTCAST':
          logger.info('Setting input to SMARTCAST via key sequence');
          await this.sendKeyPress('SMARTCAST');
          return;
          
        default:
          logger.info(`No direct key for ${normalizedInput}, trying API methods`);
          break;
      }
      
      // If we don't have a direct key, fall back to API methods
      
      // Try the documented method first (MODIFY with hashval)
      try {
        // Get current input to find hashval
        const currentInputResponse = await this.sendRequest('/menu_native/dynamic/tv_settings/devices/current_input');
        
        if (!currentInputResponse || !currentInputResponse.ITEMS || !currentInputResponse.ITEMS.length) {
          throw new Error('Failed to retrieve current input settings');
        }
        
        const currentInputItem = currentInputResponse.ITEMS[0];
        if (!currentInputItem || !currentInputItem.HASHVAL) {
          throw new Error('Could not find input HASHVAL in response');
        }
        
        const hashVal = currentInputItem.HASHVAL;
        logger.debug(`Found input HASHVAL: ${hashVal}`);
        
        // Make the PUT request with proper format
        const data = {
          REQUEST: "MODIFY",
          VALUE: normalizedInput,
          HASHVAL: hashVal
        };
        
        await this.sendRequest('/menu_native/dynamic/tv_settings/devices/current_input', 'PUT', data, true, 3);
        logger.info(`Input set to ${normalizedInput} successfully via MODIFY with hashval`);
        return;
      } catch (apiError) {
        logger.warn(`Error setting input using documented API method for input ${normalizedInput}`, {
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
        
        // Try alternative API method as last resort
        try {
          // Try cycling through inputs until we find the one we want
          // This is a fallback approach when nothing else works
          logger.info(`Trying to cycle inputs to reach ${normalizedInput}`);
          
          // First, get the current input
          const currentInput = await this.getCurrentInput();
          
          // Get available inputs
          const availableInputs = await this.getAvailableInputs();
          
          if (availableInputs.length === 0) {
            throw new Error('No available inputs found');
          }
          
          // If the current input is already the target, we're done
          if (currentInput.toUpperCase() === normalizedInput) {
            logger.info(`Already on target input ${normalizedInput}`);
            return;
          }
          
          // Try cycling through inputs (limited number of tries)
          const maxCycles = 10; // Limit how many times we'll cycle to avoid infinite loop
          for (let i = 0; i < maxCycles; i++) {
            // Send INPUT key to cycle
            await this.sendKeyPress('INPUT');
            
            // Wait a moment for the TV to respond
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if we've reached the target input
            const newInput = await this.getCurrentInput();
            if (newInput.toUpperCase() === normalizedInput) {
              logger.info(`Input set to ${normalizedInput} via input cycling`);
              return;
            }
          }
          
          throw new Error(`Failed to reach input ${normalizedInput} after ${maxCycles} cycles`);
        } catch (cycleError) {
          logger.error(`Failed to set input after multiple attempts for input ${normalizedInput}`, {
            error: cycleError instanceof Error ? cycleError.message : String(cycleError)
          });
          throw new Error(`Failed to set TV input to ${normalizedInput} after multiple attempts`);
        }
      }
    } catch (error) {
      logger.error(`Failed to set input to ${normalizedInput}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to set TV input to ${normalizedInput}`);
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
    // Different keys need different CODESET values based on Vizio API documentation
    const KEY_CODESET_MAP: Record<string, number> = {
      'BACK': 4,       // Navigation uses CODESET 4 (confirmed by testing)
      'UP': 3,         // D-Pad uses CODESET 3 (confirmed by testing)
      'DOWN': 3,       // D-Pad uses CODESET 3 (confirmed by testing)
      'LEFT': 3,       // D-Pad uses CODESET 3 (confirmed by testing)
      'RIGHT': 4,      // RIGHT uses CODESET 4 (confirmed by testing)
      'OK': 4,         // OK uses CODESET 4 with CODE 5 (confirmed by testing)
      'HOME': 3,       // HOME uses CODESET 3 with CODE 7 (confirmed by testing)
      'MENU': 4,       // MENU uses CODESET 4 (confirmed by testing)
      'EXIT': 4,       // EXIT uses CODESET 4 with CODE 1 (confirmed by testing)
      'POWER': 11,     // Power uses CODESET 11 (per Vizio API docs)
      'VOL_UP': 5,     // Volume keys use CODESET 5 (per Vizio API docs)
      'VOL_DOWN': 5,   // Volume keys use CODESET 5 (per Vizio API docs)
      'MUTE': 5,       // Mute uses CODESET 5 (per Vizio API docs)
      'CH_UP': 8,      // Channel keys use CODESET 8 (per Vizio API docs)
      'CH_DOWN': 8     // Channel keys use CODESET 8 (per Vizio API docs)
    };
    
    // Key to code mapping for navigation keys that need numeric codes
    const KEY_CODE_MAP: Record<string, number> = {
      'BACK': 0,       // BACK = CODE 0 in CODESET 4 (confirmed by testing)
      'UP': 0,         // UP = CODE 0 in CODESET 3 (confirmed by testing)
      'DOWN': 1,       // DOWN = CODE 1 in CODESET 3 (confirmed by testing)
      'LEFT': 2,       // LEFT = CODE 2 in CODESET 3 (confirmed by testing)
      'RIGHT': 3,      // RIGHT = CODE 3 in CODESET 4 (confirmed by testing)
      'OK': 5,         // OK = CODE 5 in CODESET 4 (confirmed by testing)
      'HOME': 7,       // HOME = CODE 7 in CODESET 3 (confirmed by testing)
      'MENU': 4,       // MENU = CODE 4 in CODESET 4 (confirmed by testing)
      'EXIT': 1        // EXIT = CODE 1 in CODESET 4 (confirmed by testing)
    };
    
    // For problematic buttons, try these alternative codesets as fallbacks
    const ALTERNATIVE_CODESETS: Record<string, number[]> = {
      'BACK': [4, 3],
      'UP': [3, 4],
      'DOWN': [3, 4],
      'LEFT': [3, 4],
      'RIGHT': [4, 3],
      'OK': [4, 3],
      'HOME': [3, 4],
      'MENU': [4, 3],
      'EXIT': [4, 3, 5]
    };
    
    // Multiple formats to try for this TV model - FIXED: removed data wrapper
    // since sendRequest doesn't wrap data for key_command/ endpoint
    const formats = [
      // Format 1: KEYLIST with CODESET/CODE format for navigation keys
      { KEYLIST: [
        KEY_CODE_MAP[key] !== undefined ? 
          { CODESET: KEY_CODESET_MAP[key] || 4, CODE: KEY_CODE_MAP[key], ACTION: "KEYPRESS" } :
          key
      ]},
      
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
    
    // For problematic buttons, try multiple codesets
    if (ALTERNATIVE_CODESETS[actualKey]) {
      // Try each codeset for this problematic button
      for (const codeset of ALTERNATIVE_CODESETS[actualKey]) {
        try {
          // Use the numeric codeset/code format for navigation keys
          if (KEY_CODE_MAP[actualKey] !== undefined) {
            const data = {
              KEYLIST: [{ 
                CODESET: codeset,
                CODE: KEY_CODE_MAP[actualKey],
                ACTION: "KEYPRESS" 
              }]
            };
            
            logger.debug(`Trying problematic key ${actualKey} with CODESET=${codeset}, CODE=${KEY_CODE_MAP[actualKey]}`);
            const response = await this.sendRequest('/key_command/', 'PUT', data);
            
            // Check if the response indicates success
            if (response && response.STATUS && response.STATUS.RESULT === "SUCCESS") {
              logger.info(`Key press ${actualKey} successful with CODESET=${codeset}`, { response });
              return; // Success, exit function
            }
            
            logger.warn(`Key press ${actualKey} failed with CODESET=${codeset}: ${response?.STATUS?.DETAIL || 'unknown error'}`);
          }
        } catch (error) {
          logger.warn(`Error sending key press ${actualKey} with CODESET=${codeset}`, { 
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Short pause between attempts
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // If we get here for a problematic button, all alternative codesets failed
      // Fall back to the standard approach below
      logger.warn(`All alternative codesets failed for ${actualKey}, falling back to standard approach`);
    }
    
    // Standard approach for non-problematic buttons or if alternative codesets failed
    // Try each format with decreasing delay between attempts
    for (let i = 0; i < formats.length; i++) {
      try {
        // Clone the format to avoid modifying the original
        const formatData = JSON.parse(JSON.stringify(formats[i]));
        
        // Special case for navigation buttons like BACK
        if (i === 0 && KEY_CODE_MAP[actualKey] !== undefined) {
          // Already properly formatted in the first format above
          logger.debug(`Using numeric code format for ${actualKey}: CODESET=${KEY_CODESET_MAP[actualKey]}, CODE=${KEY_CODE_MAP[actualKey]}`);
        } 
        // For other formats, update the key in the format
        else if (formatData.KEYLIST) {
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
        
        // For server errors, don't retry other formats - let the error propagate to the UI
        if (error instanceof Error && error.message.includes('Server error (500)')) {
          // Log the error to error panel
          try {
            const { addErrorToLog } = await import('../resolvers.js');
            const pubsub = (global as any).pubsub;
            if (pubsub && addErrorToLog) {
              await addErrorToLog(
                pubsub, 
                `Failed to send TV remote command: ${key}`,
                JSON.stringify({
                  request: {
                    method: 'PUT',
                    url: `${this.getBaseUrl()}/key_command/`,
                    data: JSON.stringify(formats[i], null, 2)
                  },
                  response: {
                    error: error.message
                  }
                }, null, 2)
              );
            }
          } catch (logError) {
            logger.debug('Could not add to error log channel', { logError });
          }
          
          // Throw the error to stop processing
          throw new Error(`TV remote button ${key} failed: Server did not accept the command`);
        }
        
        // Don't retry immediately, wait a bit (increasing delay for each format)
        await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
      }
    }
    
    // If all formats failed and we still have retries left, try again unless it was a server error
    if (retryCount > 0 && !(lastError instanceof Error && lastError.message.includes('Server error (500)'))) {
      logger.info(`Retrying key press ${key} with all formats, ${retryCount} attempts remaining`);
      // Add a longer delay before full retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.sendKeyPress(key, retryCount - 1);
    }
    
    // Add error to the error log panel
    try {
      const { addErrorToLog } = await import('../resolvers.js');
      const pubsub = (global as any).pubsub;
      if (pubsub && addErrorToLog) {
        await addErrorToLog(
          pubsub, 
          `Failed to send TV remote command: ${key}`,
          JSON.stringify({
            request: {
              method: 'PUT',
              url: `${this.getBaseUrl()}/key_command/`,
              data: 'Attempted multiple format variations',
              formats: JSON.stringify(formats, null, 2)
            },
            response: {
              error: lastError instanceof Error ? lastError.message : String(lastError)
            }
          }, null, 2)
        );
      }
    } catch (logError) {
      logger.debug('Could not add to error log channel', { logError });
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
      
      // Add error to the error log panel
      try {
        const { addErrorToLog } = await import('../resolvers.js');
        const pubsub = (global as any).pubsub;
        if (pubsub && addErrorToLog) {
          await addErrorToLog(
            pubsub, 
            `Failed to launch app: ${appName}`,
            JSON.stringify({
              request: {
                method: 'PUT',
                url: `${this.getBaseUrl()}/app/launch`,
                data: JSON.stringify(data, null, 2)
              },
              response: {
                error: error instanceof Error ? error.message : String(error)
              }
            }, null, 2)
          );
        }
      } catch (logError) {
        logger.debug('Could not add to error log channel', { logError });
      }
      
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