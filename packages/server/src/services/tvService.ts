import { VizioAPI, VIZIO_COMMANDS, createVizioAPIFromEnv } from '../utils/vizioApi.js';
import { logger } from '../utils/logger.js';

export type TVStatus = {
  isPoweredOn: boolean;
  volume: number;
  channel: string;
  isMuted: boolean;
  input: string;
};

class TVService {
  private vizioApi: VizioAPI | null = null;
  private isConnected: boolean = false;
  private simulationMode: boolean = false;
  private status: TVStatus = {
    isPoweredOn: false,
    volume: 50,
    channel: '1',
    isMuted: false,
    input: 'HDMI_1'
  };
  private statusPollingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Check if we should enable simulation mode
    this.simulationMode = process.env.TV_SIMULATION_MODE === 'true';
    
    if (this.simulationMode) {
      logger.info('TV Service running in simulation mode - no real TV will be contacted');
      return;
    }
    
    // Try to initialize the API from environment variables
    try {
      this.vizioApi = createVizioAPIFromEnv();
      logger.info('Vizio TV API initialized');
    } catch (error) {
      logger.warn('Failed to initialize Vizio TV API, simulation mode enabled', { error });
      this.simulationMode = true;
    }
  }
  
  /**
   * Initialize the TV connection
   */
  async init(): Promise<boolean> {
    if (this.simulationMode) {
      logger.info('TV connection initialized in simulation mode');
      return true;
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
    
    // Poll every 10 seconds
    this.statusPollingInterval = setInterval(async () => {
      try {
        await this.refreshStatus();
      } catch (error) {
        logger.error('Failed to poll TV status', { error });
      }
    }, 10000);
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
    
    return await this.vizioApi.initiatePairing();
  }
  
  /**
   * Complete pairing with the TV using the PIN displayed on screen
   */
  async completePairing(pin: string): Promise<string> {
    if (!this.vizioApi) {
      throw new Error('Vizio API not initialized');
    }
    
    const authToken = await this.vizioApi.completePairing(pin);
    logger.info('TV pairing completed successfully');
    
    // Once paired, initialize the connection
    await this.init();
    
    return authToken;
  }
  
  /**
   * Refresh the TV status
   */
  async refreshStatus(): Promise<TVStatus> {
    if (this.simulationMode) {
      // In simulation mode, just return the current status without contacting the TV
      return this.status;
    }
    
    if (!this.vizioApi) {
      return this.status;
    }
    
    try {
      const [isPoweredOn, volume, isMuted, input] = await Promise.all([
        this.vizioApi.getPowerState(),
        this.vizioApi.getVolume(),
        this.vizioApi.getMuteState(),
        this.vizioApi.getCurrentInput()
      ]);
      
      this.status = {
        ...this.status,
        isPoweredOn,
        volume,
        isMuted,
        input
      };
      
      logger.debug('TV status refreshed', { status: this.status });
    } catch (error) {
      logger.error('Error refreshing TV status', { error });
    }
    
    return this.status;
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
          
        case 'APP_YOUTUBE':
          if (!this.status.isPoweredOn) return false;
          await this.vizioApi.launchApp('YouTube');
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
            logger.warn(`Unknown TV command: ${command}`);
            return false;
          }
      }
      
      logger.info(`TV command sent: ${command}`, { value });
      return true;
    } catch (error) {
      logger.error(`Error sending TV command: ${command}`, { error, value });
      
      // If command fails, still update local state as a fallback
      this.updateLocalState(command, value);
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
    return this.isConnected;
  }
}

// Create a singleton instance of the TV service
export const tvService = new TVService(); 