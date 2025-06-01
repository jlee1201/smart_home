import { VizioAPI, VIZIO_COMMANDS, createVizioAPIFromEnv, createVizioAPIFromDB } from '../utils/vizioApi.js';
import { logger } from '../utils/logger.js';
import { tvSettingsService } from './tvSettingsService.js';
import { TV_STATUS_CHANNEL } from '../resolvers.js';

export type TVStatus = {
  isPoweredOn: boolean;
  volume: number;
  channel: string;
  isMuted: boolean;
  input: string;
  supportedInputs: string[];
  currentApp: string;
};

class TVService {
  private vizioApi: VizioAPI | null = null;
  private isConnected: boolean = false;
  private hasValidAuthToken: boolean = false;
  private simulationMode: boolean = false;
  private status: TVStatus = {
    isPoweredOn: false,
    volume: 30,
    channel: '1',
    isMuted: false,
    input: 'HDMI1',
    supportedInputs: ['HDMI1', 'HDMI2', 'HDMI3', 'HDMI4'],
    currentApp: 'Unknown'
  };
  private statusPollingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Set default values for simulation mode
    this.status = {
      isPoweredOn: false,
      volume: 30,
      channel: '1',
      isMuted: false,
      input: 'HDMI1',
      supportedInputs: ['HDMI1', 'HDMI2', 'HDMI3', 'HDMI4'],
      currentApp: 'Unknown'
    };
    
    // Only enter simulation mode if explicitly set to 'false'
    // This makes TV connection enabled by default
    const enableTVConnection = process.env.ENABLE_TV_CONNECTION !== 'false';
    this.simulationMode = !enableTVConnection;
    
    logger.info(`TV Service initializing with enableTVConnection=${enableTVConnection}, simulationMode=${this.simulationMode}`);
  }
  
  /**
   * Initialize the TV connection
   */
  async init(): Promise<boolean> {
    if (this.simulationMode) {
      logger.info('TV service initialized in simulation mode');
      return true;
    }
    
    try {
      // Try to get settings from database
      const dbSettings = await tvSettingsService.getSettings();
      
      if (dbSettings && dbSettings.authToken) {
        logger.info('Using TV settings from database');
        this.vizioApi = await createVizioAPIFromDB(dbSettings);
        this.hasValidAuthToken = true;
      } else if (process.env.VIZIO_TV_IP) {
        // Fall back to environment variables if database doesn't have settings
        logger.info('Using TV settings from environment variables');
        this.vizioApi = createVizioAPIFromEnv();
        this.hasValidAuthToken = !!process.env.VIZIO_AUTH_TOKEN;
        
        // Save the environment settings to the database if they don't exist
        if (!dbSettings) {
          await tvSettingsService.saveSettings({
            ip: process.env.VIZIO_TV_IP,
            authToken: process.env.VIZIO_AUTH_TOKEN || null,
            port: parseInt(process.env.VIZIO_TV_PORT || '7345', 10),
            deviceName: process.env.VIZIO_DEVICE_NAME || 'SmartHome Controller'
          });
        }
      } else {
        logger.warn('Cannot initialize TV connection: No settings available');
        this.simulationMode = true;
        this.hasValidAuthToken = false;
        return false;
      }
      
      logger.info('Vizio TV API initialized');
    } catch (error) {
      logger.warn('Failed to initialize Vizio TV API, simulation mode enabled', { error });
      this.simulationMode = true;
      this.isConnected = false;
      return false;
    }
    
    if (!this.vizioApi) {
      logger.warn('Cannot initialize TV connection: API not initialized');
      return false;
    }
    
    try {
      // Try to get power state to test the connection
      await this.refreshStatus();
      this.isConnected = true;
      this.startPolling();
      logger.info('TV connection initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize TV connection', { error });
      this.simulationMode = true;
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Start polling for TV status updates
   */
  private startPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
    
    // Poll every 5 seconds (reduced from 10 seconds for better responsiveness)
    this.statusPollingInterval = setInterval(async () => {
      try {
        await this.refreshStatus();
      } catch (error) {
        logger.error('Failed to poll TV status', { error });
      }
    }, 5000);
  }
  
  /**
   * Stop polling for TV status updates
   */
  stopPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }
  
  /**
   * Initiate pairing with the TV
   */
  async initiatePairing(): Promise<string> {
    if (!this.vizioApi) {
      throw new Error('Vizio API not initialized');
    }
    
    try {
      logger.info('Initiating TV pairing process');
      const result = await this.vizioApi.initiatePairing();
      logger.info('TV pairing initiation successful with result:', { result });
      return result;
    } catch (error) {
      const typedError = error as Error;
      logger.error('Error in initiatePairing', { 
        error: { 
          message: typedError.message || 'Unknown error',
          name: typedError.name || 'Unknown error type',
          stack: typedError.stack || 'No stack trace'
        } 
      });
      
      // In some cases, even though there's an error, the PIN is actually displayed on screen
      // This happens particularly with newer Vizio models that don't return a challenge key
      // but still display the PIN
      if (!typedError.message || typedError.message.includes('Invalid response format')) {
        logger.info('Returning PIN_ON_SCREEN despite error - PIN likely displayed on TV');
        return "PIN_ON_SCREEN";
      }
      
      throw error;
    }
  }
  
  /**
   * Complete pairing with the TV using the PIN displayed on screen
   */
  async completePairing(pin: string): Promise<string> {
    if (!this.vizioApi) {
      throw new Error('Vizio API not initialized');
    }
    
    try {
      logger.info('Completing TV pairing with PIN');
      const response = await this.vizioApi.completePairing(pin);
      logger.info('TV pairing completed successfully, verifying token');
      
      // Verify the token works by trying a simple authenticated request
      try {
        // Set the token first
        if (this.vizioApi) {
          // @ts-ignore - Accessing private property to set auth
          this.vizioApi.authToken = response;
        }
        
        // Try to get the power state to verify the token works
        const isPowered = await this.vizioApi.getPowerState();
        logger.info('Auth token verified successfully', { isPowered });
      } catch (verifyError: any) {
        logger.error('Auth token verification failed', { error: verifyError?.message || 'Unknown error' });
        throw new Error('Authentication failed after pairing. The TV returned a token but it was rejected on subsequent requests.');
      }
      
      // If we get here, the token is valid - save it to the database
      try {
        await tvSettingsService.saveAuthToken(response);
        logger.info('Auth token saved to database');
        this.hasValidAuthToken = true;
      } catch (error: any) {
        logger.error('Failed to save auth token to database', { error: error?.message || 'Unknown error' });
        // Continue anyway since we have the token in memory
      }
      
      // Once paired, initialize the connection
      await this.init();
      
      return response;
    } catch (error: any) {
      logger.error('Error in completePairing', { 
        error: { 
          message: error?.message || 'Unknown error',
          name: error?.name || 'Unknown error type',
          stack: error?.stack || 'No stack trace'
        } 
      });
      
      // Check for specific error types for better user feedback
      const errorMsg = error?.message || '';
      
      if (errorMsg.includes('INVALID_PARAMETER')) {
        throw new Error('Pairing failed: The pairing session expired or is invalid. Please restart the pairing process.');
      }
      
      // Check if the error is specifically about PIN rejection
      if (errorMsg.includes('INVALID_PIN') || 
          errorMsg.includes('CHALLENGE_INCORRECT') ||
          errorMsg.includes('code 403') ||
          errorMsg.includes('PIN') ||
          error?.status === 403) {
        throw new Error('Invalid PIN: The TV rejected the PIN you entered. Please try again with the correct PIN.');
      }
      
      // For all other errors, throw a generic error
      throw new Error('Failed to complete TV pairing: ' + errorMsg);
    }
  }
  
  /**
   * Refresh the TV status
   */
  async refreshStatus(): Promise<TVStatus> {
    if (this.simulationMode) {
      // In simulation mode, just return the current status without contacting the TV
      return this.status;
    }
    
    if (!this.vizioApi || !this.hasValidAuthToken) {
      // Don't attempt API calls when we don't have a valid auth token
      return this.status;
    }
    
    try {
      // Store previous status for change detection
      const prevStatus = { ...this.status };

      // First try to get the power state
      try {
        const isPoweredOn = await this.vizioApi.getPowerState();
        this.status.isPoweredOn = isPoweredOn;
      } catch (powerError: any) {
        logger.warn('Error getting power state', { error: powerError?.message || 'Empty error' });
        
        // Check if this is a 400 or 403 error, which indicates authentication problems
        if (powerError?.status === 400 || powerError?.status === 403 || 
            (powerError?.message && (
              powerError.message.includes('400') || 
              powerError.message.includes('403') ||
              powerError.message.includes('Unauthorized') ||
              powerError.message.includes('Bad Request')
            ))
        ) {
          logger.warn('Authentication error detected during TV status refresh - invalidating connection');
          this.handleAuthenticationFailure();
          return this.status;
        }
        
        // If we can't get power state but the TV responded at all, assume it's on
        this.status.isPoweredOn = true;
      }
      
      // Only fetch other properties if the TV is on
      if (this.status.isPoweredOn && this.hasValidAuthToken) {
        try {
          const volume = await this.vizioApi.getVolume();
          this.status.volume = volume;
        } catch (error: any) {
          logger.warn('Error getting volume', { error: error?.message || 'Empty error' });
          this.checkForAuthError(error);
          // Exit early after auth error to avoid more failed requests
          if (!this.hasValidAuthToken) return this.status;
        }
        
        if (this.hasValidAuthToken) {
          try {
            const isMuted = await this.vizioApi.getMuteState();
            this.status.isMuted = isMuted;
          } catch (error: any) {
            logger.warn('Error getting mute state', { error: error?.message || 'Empty error' });
            this.checkForAuthError(error);
            // Exit early after auth error to avoid more failed requests
            if (!this.hasValidAuthToken) return this.status;
          }
        }
        
        if (this.hasValidAuthToken) {
          try {
            const input = await this.vizioApi.getCurrentInput();
            if (input) {
              this.status.input = input;
            }
          } catch (error: any) {
            logger.warn('Error getting current input', { error: error?.message || 'Empty error' });
            this.checkForAuthError(error);
          }
        }

        // Get available inputs from the TV if supported
        if (this.hasValidAuthToken) {
          try {
            const availableInputs = await this.vizioApi.getAvailableInputs();
            if (availableInputs && availableInputs.length > 0) {
              this.status.supportedInputs = availableInputs;
            }
          } catch (error: any) {
            // This is non-critical, so just log a debug message
            logger.debug('Could not retrieve available inputs from TV', { 
              error: error?.message || 'Empty error' 
            });
          }
        }

        // Get current app if TV is on and input is SMARTCAST
        if (this.hasValidAuthToken && this.status.input === 'SMARTCAST') {
          try {
            const previousApp = this.status.currentApp;
            const currentApp = await this.vizioApi.getCurrentApp();
            this.status.currentApp = currentApp;
            
            // Check if app changed and emit event for real-time updates
            if (previousApp !== currentApp && previousApp !== 'Unknown') {
              logger.info(`TV app changed from ${previousApp} to ${currentApp}`);
              this.emitAppChangeEvent(currentApp, previousApp);
            }
          } catch (error: any) {
            logger.debug('Could not retrieve current app from TV', { 
              error: error?.message || 'Empty error' 
            });
            // Set to unknown if we can't determine the app
            this.status.currentApp = 'Unknown';
          }
        } else if (this.status.input !== 'SMARTCAST') {
          // If not on SMARTCAST input, no app is running
          const previousApp = this.status.currentApp;
          this.status.currentApp = 'No App Running';
          
          // Emit app change event if we were previously showing an app
          if (previousApp !== 'No App Running' && previousApp !== 'Unknown') {
            logger.info(`TV app changed from ${previousApp} to No App Running (input: ${this.status.input})`);
            this.emitAppChangeEvent('No App Running', previousApp);
          }
        }
      }
      
      // Check for status changes and publish if any occurred
      const hasChanges = JSON.stringify(prevStatus) !== JSON.stringify(this.status);
      if (hasChanges) {
        logger.info('TV status changed during refresh', { 
          previous: prevStatus,
          current: this.status
        });
        this.publishStatusChange();
      } else {
        logger.debug('TV status refreshed (no changes)', { status: this.status });
      }
    } catch (error: any) {
      logger.warn('Error refreshing TV status', { error: error?.message || 'Empty error' });
      this.checkForAuthError(error);
    }
    
    return this.status;
  }
  
  /**
   * Check if an error is an authentication error and handle it if it is
   */
  private checkForAuthError(error: any): void {
    if (!error) {
      logger.warn('Empty error detected during TV operation - treating as auth failure');
      this.handleAuthenticationFailure();
      return;
    }
    
    // Check if the error is a 400 or 403, which typically indicates auth issues
    if (
      error?.status === 400 || 
      error?.status === 403 || 
      (error?.message && (
        error.message.includes('400') || 
        error.message.includes('403') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Bad Request')
      ))
    ) {
      // Don't log here, as handleAuthenticationFailure will log once
      this.handleAuthenticationFailure();
    }
  }
  
  /**
   * Handle authentication failure by invalidating the connection
   * and stopping polling
   */
  private handleAuthenticationFailure(): void {
    // Only take action if we previously thought we were connected
    if (this.isConnected || this.hasValidAuthToken) {
      // Mark as not connected
      this.isConnected = false;
      this.hasValidAuthToken = false;
      
      // Stop polling
      this.stopPolling();
      
      // Log the event (only once)
      logger.warn('TV connection invalidated due to authentication error. Polling stopped.');
      
      // The following events notification is commented out as it's not critical and was adding noise to logs
      /*
      // Emit an event that subscribers can listen to
      try {
        // This is just to ensure that any monitors/subscribers will get notified
        // of the connection change
        const event = new CustomEvent('tv-connection-change', { 
          detail: { connected: false, error: 'Authentication failure' } 
        });
        
        // Dispatch to the global object (if in a browser context)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(event);
        }
        
        // If in Node.js context
        if (typeof process !== 'undefined') {
          process.emit('tv-connection-change', { connected: false, error: 'Authentication failure' });
        }
      } catch (e) {
        // Ignore errors from emitting the event
        logger.debug('Failed to emit tv-connection-change event', { error: e });
      }
      */
    }
  }

  /**
   * Emit app change event for real-time subscriptions
   */
  private emitAppChangeEvent(currentApp: string, previousApp: string): void {
    try {
      // Import the pubsub instance and publish app change event
      const pubsub = (global as any).pubsub;
      if (pubsub) {
        pubsub.publish('APP_CHANGED', {
          appChanged: {
            currentApp,
            previousApp,
            timestamp: new Date().toISOString(),
            tvStatus: this.status
          }
        });
        logger.debug('Published app change event', { currentApp, previousApp });
      }
    } catch (error) {
      logger.debug('Failed to emit app change event', { error });
    }
  }

  /**
   * Publish general TV status changes to GraphQL subscriptions
   */
  private publishStatusChange(): void {
    try {
      const pubsub = (global as any).pubsub;
      if (pubsub) {
        pubsub.publish(TV_STATUS_CHANNEL, { 
          tvStatusChanged: this.status 
        });
        logger.debug('Published TV status change to GraphQL subscriptions', { status: this.status });
      }
    } catch (error) {
      logger.debug('Failed to publish TV status change', { error });
    }
  }
  
  /**
   * Get the current TV status
   */
  getStatus(): TVStatus {
    return this.status;
  }
  
  /**
   * Send a command to the TV
   */
  async sendCommand(command: string, value?: string): Promise<boolean> {
    if (this.simulationMode || !this.vizioApi) {
      // If in simulation mode or no API connection, just update local state
      this.updateLocalState(command, value);
      if (this.simulationMode) {
        logger.info(`TV command simulated: ${command}`, { value });
      }
      return true;
    }
    
    try {
      // Special handling for problematic commands on this TV model
      if (command === 'BACK') {
        // The BACK command is particularly problematic on this TV model
        // Try multiple approaches with increasing delays to ensure it works
        try {
          // First attempt: try standard key press
          await this.vizioApi.sendKeyPress('BACK');
          
          // Additional attempts with different approaches if needed in the future
          // For now the improved sendKeyPress method should handle it
        } catch (backError) {
          logger.warn('Error sending BACK command via standard method', {
            error: backError instanceof Error ? backError.message : String(backError)
          });
          
          // Fall back to updating local state in case of error to keep UI in sync
          this.updateLocalState(command, value);
          
          // If it's a server error, add to error log and return false to indicate failure
          if (backError instanceof Error && backError.message.includes('Server error')) {
            try {
              const { addErrorToLog } = await import('../resolvers.js');
              const pubsub = (global as any).pubsub;
              if (pubsub && addErrorToLog) {
                await addErrorToLog(
                  pubsub, 
                  `Failed to send BACK command to TV`,
                  `The TV returned an error when processing this command.`
                );
              }
            } catch (logError) {
              logger.debug('Could not add to error log channel', { logError });
            }
            return false;
          }
        }
        
        return true;
      }
      
      switch (command) {
        case 'POWER':
          await this.vizioApi.togglePower();
          this.status.isPoweredOn = !this.status.isPoweredOn;
          break;
          
        case 'VOLUME_UP':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.sendKeyPress(VIZIO_COMMANDS.VOLUME_UP);
          this.status.volume = Math.min(100, this.status.volume + 5);
          break;
          
        case 'VOLUME_DOWN':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.sendKeyPress(VIZIO_COMMANDS.VOLUME_DOWN);
          this.status.volume = Math.max(0, this.status.volume - 5);
          break;
          
        case 'MUTE':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.toggleMute();
          this.status.isMuted = !this.status.isMuted;
          break;
          
        case 'CHANNEL':
          if (!this.status.isPoweredOn || !value) return false;
          await this.vizioApi.setChannel(value);
          this.status.channel = value;
          break;
          
        case 'INPUT_HDMI_1':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.setInput('HDMI-1');
          this.status.input = 'HDMI_1';
          break;
          
        case 'INPUT_HDMI_2':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.setInput('HDMI-2');
          this.status.input = 'HDMI_2';
          break;
          
        case 'INPUT_TV':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.setInput('TV');
          this.status.input = 'TV';
          break;
          
        case 'APP_NETFLIX':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.launchApp('Netflix');
          break;
          
        case 'APP_YOUTUBE_TV':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.launchApp('YouTubeTV');
          break;
          
        case 'APP_PRIME':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.launchApp('Amazon Prime Video');
          break;
          
        case 'APP_DISNEY':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.launchApp('Disney+');
          break;
          
        default:
          // For other commands like navigation keys, just use the command map
          if (VIZIO_COMMANDS[command as keyof typeof VIZIO_COMMANDS]) {
            if (!this.status.isPoweredOn) return false;
            await this.vizioApi.sendKeyPress(VIZIO_COMMANDS[command as keyof typeof VIZIO_COMMANDS]);
          } else if (command.startsWith('NUMBER') && value) {
            if (!this.status.isPoweredOn) return false;
            await this.vizioApi.sendKeyPress(`NUM_${value}`);
          } else {
            logger.warn(`Unknown command: ${command}`);
            return false;
          }
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending command to TV', { error });
      
      // Add to error log panel - will show in UI
      try {
        const { addErrorToLog } = await import('../resolvers.js');
        const pubsub = (global as any).pubsub;
        if (pubsub && addErrorToLog) {
          await addErrorToLog(
            pubsub, 
            `Failed to send TV command: ${command}`,
            JSON.stringify({
              request: {
                command,
                value: value || null
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
      
      // If there's an error, update the local state to provide some feedback
      // but only for non-server errors where the command might actually have worked
      // but we just couldn't confirm it
      if (!(error instanceof Error && error.message.includes('Server error'))) {
        this.updateLocalState(command, value);
      }
      
      return false;
    }
  }
  
  /**
   * Update local state when no TV connection is available
   */
  private updateLocalState(command: string, value?: string): void {
    switch (command) {
      case 'POWER':
        this.status.isPoweredOn = !this.status.isPoweredOn;
        break;
      case 'VOLUME_UP':
        if (this.status.isPoweredOn) {
          this.status.volume = Math.min(100, this.status.volume + 5);
        }
        break;
      case 'VOLUME_DOWN':
        if (this.status.isPoweredOn) {
          this.status.volume = Math.max(0, this.status.volume - 5);
        }
        break;
      case 'MUTE':
        if (this.status.isPoweredOn) {
          this.status.isMuted = !this.status.isMuted;
        }
        break;
      case 'CHANNEL':
        if (this.status.isPoweredOn && value) {
          this.status.channel = value;
        }
        break;
      case 'INPUT_HDMI_1':
        if (this.status.isPoweredOn) {
          this.status.input = 'HDMI_1';
        }
        break;
      case 'INPUT_HDMI_2':
        if (this.status.isPoweredOn) {
          this.status.input = 'HDMI_2';
        }
        break;
      case 'INPUT_TV':
        if (this.status.isPoweredOn) {
          this.status.input = 'TV';
        }
        break;
    }
  }
  
  /**
   * Check if connected to a TV
   */
  isConnectedToTV(): boolean {
    if (this.simulationMode) {
      // In simulation mode, we're always "connected"
      return true;
    }
    
    // Consider connected even if we have an auth token that starts with SIMULATED
    // This handles the case where we couldn't get a real token but want to provide functionality
    if (this.hasValidAuthToken) {
      return true;
    }
    
    // Only consider TV connected if we have both a physical connection AND a valid auth token
    return this.isConnected && this.hasValidAuthToken;
  }
  
  /**
   * Reset the TV connection by clearing the authentication token
   * This is used to force re-pairing without requiring a TV reboot
   */
  async resetTVConnection(): Promise<boolean> {
    logger.info('Resetting TV connection');
    
    // Clear the auth token in memory
    if (this.vizioApi) {
      // @ts-ignore - Accessing private property to reset auth
      this.vizioApi.authToken = null;
    }
    
    this.hasValidAuthToken = false;
    
    // Clear the auth token in the database
    try {
      await tvSettingsService.saveAuthToken('');
      logger.info('Cleared TV auth token from database');
    } catch (error) {
      logger.error('Failed to clear auth token from database', { error });
    }
    
    // Attempt to cancel any in-progress pairing
    if (this.vizioApi) {
      try {
        await this.vizioApi.cancelPairing();
        logger.info('Cancelled any in-progress pairing requests');
      } catch (error) {
        logger.error('Failed to cancel pairing during reset', { error });
      }
    }
    
    // Reset other state
    this.isConnected = false;
    this.simulationMode = process.env.ENABLE_TV_CONNECTION !== 'true';
    
    // Create a new VizioAPI instance with a new device ID to help clear any blocked pairing state
    if (!this.simulationMode) {
      try {
        const settings = await tvSettingsService.getSettings();
        if (settings) {
          logger.info('Creating new VizioAPI instance with new device ID to clear blocked state');
          // Generate a new device ID to avoid any existing blocking
          const newDeviceId = crypto.randomUUID();
          this.vizioApi = new VizioAPI({
            ip: settings.ip,
            port: settings.port || 7345,
            deviceId: newDeviceId,
            deviceName: `SmartHome Controller ${Math.floor(Math.random() * 1000)}`
          });
          
          // Save the new device ID
          await tvSettingsService.saveSettings({
            ...settings,
            deviceId: newDeviceId
          });
        }
      } catch (error) {
        logger.error('Error creating new VizioAPI instance during reset', { error });
      }
    }
    
    // Return success
    return true;
  }
  
  /**
   * Get the VizioAPI instance for direct operations
   */
  getVizioApi(): VizioAPI | null {
    return this.vizioApi;
  }
}

// Create a singleton instance of the TV service
export const tvService = new TVService();