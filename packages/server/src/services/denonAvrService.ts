import { DenonTelnetAPI, DENON_COMMANDS } from '../utils/denonTelnetApi.js';
import { denonTelnetApi } from '../config/denon.js';
import { logger } from '../utils/logger.js';

export type DenonAVRStatus = {
  isPoweredOn: boolean;
  volume: number;
  isMuted: boolean;
  input: string;
  soundMode: string;
};

class DenonAVRService {
  private denonApi: DenonTelnetAPI | null = null;
  private isConnected: boolean = false;
  private simulationMode: boolean = false;
  private status: DenonAVRStatus = {
    isPoweredOn: false,
    volume: 0,
    isMuted: false,
    input: '',
    soundMode: ''
  };
  private statusPollingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Set default values for simulation mode
    this.status = {
      isPoweredOn: false,
      volume: 0,
      isMuted: false,
      input: '',
      soundMode: ''
    };
    
    // Check if AVR connection is enabled
    this.simulationMode = process.env.ENABLE_AVR_CONNECTION !== 'true';
    
    if (this.simulationMode) {
      logger.info('Denon AVR Service running in simulation mode - no real AVR will be contacted');
      this.isConnected = false;
      return;
    }
    
    // Try to initialize the API
    try {
      this.denonApi = denonTelnetApi;
      logger.info('Denon AVR Telnet API initialized');
    } catch (error) {
      logger.warn('Failed to initialize Denon AVR Telnet API, simulation mode enabled', { error });
      this.simulationMode = true;
      this.isConnected = false;
    }
  }
  
  /**
   * Initialize the AVR connection
   */
  async init(): Promise<boolean> {
    if (this.simulationMode) {
      logger.info('Denon AVR service initialized in simulation mode');
      return true;
    }
    
    if (!this.denonApi) {
      logger.warn('Cannot initialize Denon AVR connection: API not initialized');
      return false;
    }
    
    try {
      // Try to get power state directly first to test the connection
      const isPoweredOn = await this.denonApi.getPowerState();
      logger.info('Initial Denon AVR power state check', { isPoweredOn });
      
      // Then do a full refresh of all status parameters
      await this.refreshStatus(false);
      
      this.isConnected = true;
      this.startPolling();
      
      // Force another immediate refresh after a short delay to ensure all status is current
      setTimeout(() => this.refreshStatus(false), 2000);
      
      logger.info('Denon AVR connection initialized successfully', { status: this.status });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Denon AVR connection', { error });
      this.simulationMode = true;
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Start polling for AVR status updates
   */
  private startPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
    
    // Poll every 30 seconds (increased from 10 seconds to reduce log noise)
    this.statusPollingInterval = setInterval(async () => {
      try {
        await this.refreshStatus(true);
      } catch (error) {
        logger.error('Failed to poll Denon AVR status', { error });
      }
    }, 30000);
  }
  
  /**
   * Stop polling for AVR status updates
   */
  stopPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }
  
  /**
   * Refresh the AVR status
   * @param silent If true, suppresses status update logging (for polling)
   */
  async refreshStatus(silent: boolean = false): Promise<DenonAVRStatus> {
    if (this.simulationMode) {
      // In simulation mode, just return the current status without contacting the AVR
      return this.status;
    }
    
    if (!this.denonApi) {
      return this.status;
    }
    
    try {
      // Check power state first
      const isPoweredOn = await this.denonApi.getPowerState();
      
      // Only fetch other status if powered on
      let volume = 0;
      let isMuted = false;
      let input = '';
      let soundMode = '';
      
      if (isPoweredOn) {
        // Use Promise.allSettled to handle partial failures
        const results = await Promise.allSettled([
          this.denonApi.getVolume(),
          this.denonApi.getMuteState(),
          this.denonApi.getCurrentInput(),
          this.denonApi.getSoundMode()
        ]);
        
        // Process results and handle any failures
        if (results[0].status === 'fulfilled') {
          volume = results[0].value;
        } else {
          logger.error('Failed to get volume', { reason: results[0].reason });
          // Keep the previous volume value if this failed
          volume = this.status.volume;
        }
        
        if (results[1].status === 'fulfilled') {
          isMuted = results[1].value;
        } else {
          logger.error('Failed to get mute state', { reason: results[1].reason });
          isMuted = this.status.isMuted;
        }
        
        if (results[2].status === 'fulfilled') {
          input = results[2].value;
        } else {
          logger.error('Failed to get input', { reason: results[2].reason });
          input = this.status.input;
        }
        
        if (results[3].status === 'fulfilled') {
          soundMode = results[3].value;
        } else {
          logger.error('Failed to get sound mode', { reason: results[3].reason });
          soundMode = this.status.soundMode;
        }
      }
      
      const prevStatus = { ...this.status };
      
      // Only update status values that actually changed or if we're powered on
      const newStatus = {
        isPoweredOn,
        volume: isPoweredOn ? volume : 0,
        isMuted: isPoweredOn ? isMuted : false,
        input: isPoweredOn ? input : '',
        soundMode: isPoweredOn ? soundMode : ''
      };
      
      // Only update the status if we have valid data
      if (isPoweredOn) {
        this.status = newStatus;
      } else if (prevStatus.isPoweredOn && !isPoweredOn) {
        // If power state transitions from on to off, update the status
        this.status = newStatus;
      } else if (!prevStatus.isPoweredOn && !isPoweredOn) {
        // If we're already reporting powered off and still get powered off, verify with an additional check
        logger.debug('Double-checking power state since multiple off reports received');
        const verifyPowerState = await this.denonApi.getPowerState();
        
        if (verifyPowerState) {
          // If the verification shows it's actually on, update status
          logger.info('Power state verification shows AVR is actually ON');
          
          // Force a complete refresh with the correct power state
          return this.refreshStatus(silent);
        } else {
          // Confirmed it's off, update status
          this.status = newStatus;
        }
      }
      
      // Only log if there's an actual change or if not in silent mode
      const hasChanged = JSON.stringify(prevStatus) !== JSON.stringify(this.status);
      
      if (hasChanged) {
        // Always log state changes
        logger.info('Denon AVR status changed', { 
          previous: prevStatus,
          current: this.status
        });
      } else if (!silent) {
        logger.debug('Denon AVR status refreshed (no change)', { status: this.status });
      }
    } catch (error) {
      logger.error('Error refreshing Denon AVR status', { error });
    }
    
    return this.status;
  }
  
  /**
   * Get the current AVR status
   */
  getStatus(): DenonAVRStatus {
    return this.status;
  }
  
  /**
   * Send a command to the AVR
   */
  async sendCommand(command: string, value?: string): Promise<boolean> {
    if (this.simulationMode || !this.denonApi) {
      // If in simulation mode or no API connection, just update local state
      this.updateLocalState(command, value);
      if (this.simulationMode) {
        logger.info(`Denon AVR command simulated: ${command}`, { value });
      }
      return true;
    }
    
    try {
      switch (command) {
        case 'POWER_ON':
          await this.denonApi.powerOn();
          this.status.isPoweredOn = true;
          break;
          
        case 'POWER_OFF':
          await this.denonApi.powerOff();
          this.status.isPoweredOn = false;
          break;
          
        case 'VOLUME_UP':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.volumeUp();
          this.status.volume = Math.min(100, this.status.volume + 2);
          break;
          
        case 'VOLUME_DOWN':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.volumeDown();
          this.status.volume = Math.max(0, this.status.volume - 2);
          break;
          
        case 'SET_VOLUME':
          if (!this.status.isPoweredOn || !value) return false;
          const volumeLevel = parseInt(value, 10);
          await this.denonApi.setVolume(volumeLevel);
          this.status.volume = volumeLevel;
          break;
          
        case 'MUTE_TOGGLE':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.toggleMute();
          this.status.isMuted = !this.status.isMuted;
          break;
          
        case 'MUTE_ON':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.setMute(true);
          this.status.isMuted = true;
          break;
          
        case 'MUTE_OFF':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.setMute(false);
          this.status.isMuted = false;
          break;
          
        case 'INPUT_CHANGE':
          if (!this.status.isPoweredOn || !value) return false;
          await this.denonApi.setInput(value);
          this.status.input = value;
          break;
          
        case 'SOUND_MODE':
          if (!this.status.isPoweredOn || !value) return false;
          await this.denonApi.setSoundMode(value);
          this.status.soundMode = value;
          break;
          
        case 'NAVIGATE':
          if (!this.status.isPoweredOn || !value) return false;
          await this.denonApi.navigate(value as any);
          break;
          
        case 'PLAYBACK':
          if (!this.status.isPoweredOn || !value) return false;
          await this.denonApi.playbackControl(value as any);
          break;
          
        // Input selection shortcuts
        case 'INPUT_TV':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.INPUT_TV);
          this.status.input = 'TV';
          break;
          
        case 'INPUT_BLURAY':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.INPUT_BD);
          this.status.input = 'BD';
          break;
          
        case 'INPUT_GAME':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.INPUT_GAME);
          this.status.input = 'GAME';
          break;
          
        case 'INPUT_CBL_SAT':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.INPUT_CBL_SAT);
          this.status.input = 'CBL/SAT';
          break;
          
        case 'INPUT_BLUETOOTH':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.INPUT_BLUETOOTH);
          this.status.input = 'BT';
          break;
          
        // Sound mode shortcuts
        case 'SOUND_MOVIE':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.SOUND_MOVIE);
          this.status.soundMode = 'MOVIE';
          break;
          
        case 'SOUND_MUSIC':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.SOUND_MUSIC);
          this.status.soundMode = 'MUSIC';
          break;
          
        case 'SOUND_GAME':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.SOUND_GAME);
          this.status.soundMode = 'GAME';
          break;
          
        case 'SOUND_DIRECT':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.SOUND_DIRECT);
          this.status.soundMode = 'DIRECT';
          break;
          
        case 'SOUND_STEREO':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.sendCommand(DENON_COMMANDS.SOUND_STEREO);
          this.status.soundMode = 'STEREO';
          break;
          
        default:
          logger.warn(`Unknown Denon AVR command: ${command}`);
          return false;
      }
      
      logger.info(`Denon AVR command sent: ${command}`, { value });
      return true;
    } catch (error) {
      logger.error(`Error sending Denon AVR command: ${command}`, { error, value });
      return false;
    }
  }
  
  /**
   * Update local state in simulation mode
   */
  private updateLocalState(command: string, value?: string): void {
    switch (command) {
      case 'POWER_ON':
        this.status.isPoweredOn = true;
        break;
        
      case 'POWER_OFF':
        this.status.isPoweredOn = false;
        break;
        
      case 'VOLUME_UP':
        if (!this.status.isPoweredOn) return;
        this.status.volume = Math.min(100, this.status.volume + 2);
        break;
        
      case 'VOLUME_DOWN':
        if (!this.status.isPoweredOn) return;
        this.status.volume = Math.max(0, this.status.volume - 2);
        break;
        
      case 'SET_VOLUME':
        if (!this.status.isPoweredOn || !value) return;
        this.status.volume = parseInt(value, 10);
        break;
        
      case 'MUTE_TOGGLE':
        if (!this.status.isPoweredOn) return;
        this.status.isMuted = !this.status.isMuted;
        break;
        
      case 'MUTE_ON':
        if (!this.status.isPoweredOn) return;
        this.status.isMuted = true;
        break;
        
      case 'MUTE_OFF':
        if (!this.status.isPoweredOn) return;
        this.status.isMuted = false;
        break;
        
      case 'INPUT_CHANGE':
        if (!this.status.isPoweredOn || !value) return;
        this.status.input = value;
        break;
        
      case 'SOUND_MODE':
        if (!this.status.isPoweredOn || !value) return;
        this.status.soundMode = value;
        break;
        
      // Input selection shortcuts
      case 'INPUT_TV':
        if (!this.status.isPoweredOn) return;
        this.status.input = 'TV';
        break;
        
      case 'INPUT_BLURAY':
        if (!this.status.isPoweredOn) return;
        this.status.input = 'BD';
        break;
        
      case 'INPUT_GAME':
        if (!this.status.isPoweredOn) return;
        this.status.input = 'GAME';
        break;
        
      case 'INPUT_CBL_SAT':
        if (!this.status.isPoweredOn) return;
        this.status.input = 'CBL/SAT';
        break;
        
      case 'INPUT_BLUETOOTH':
        if (!this.status.isPoweredOn) return;
        this.status.input = 'BT';
        break;
        
      // Sound mode shortcuts
      case 'SOUND_MOVIE':
        if (!this.status.isPoweredOn) return;
        this.status.soundMode = 'MOVIE';
        break;
        
      case 'SOUND_MUSIC':
        if (!this.status.isPoweredOn) return;
        this.status.soundMode = 'MUSIC';
        break;
        
      case 'SOUND_GAME':
        if (!this.status.isPoweredOn) return;
        this.status.soundMode = 'GAME';
        break;
        
      case 'SOUND_DIRECT':
        if (!this.status.isPoweredOn) return;
        this.status.soundMode = 'DIRECT';
        break;
        
      case 'SOUND_STEREO':
        if (!this.status.isPoweredOn) return;
        this.status.soundMode = 'STEREO';
        break;
    }
  }
  
  /**
   * Check if we're connected to the AVR
   */
  isConnectedToAVR(): boolean {
    return this.isConnected || this.simulationMode;
  }
}

// Create a singleton instance of the service
export const denonAvrService = new DenonAVRService(); 