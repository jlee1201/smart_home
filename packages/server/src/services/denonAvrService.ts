import { DenonTelnetAPI, DENON_COMMANDS } from '../utils/denonTelnetApi.js';
import { denonTelnetApi } from '../config/denon.js';
import { logger } from '../utils/logger.js';
import { DENON_AVR_STATUS_CHANNEL } from '../resolvers.js';
import net from 'net';
import { createDenonAPIFromEnv } from '../utils/denonApi.js';
import type { DenonAPI } from '../utils/denonApi.js';

export type DenonAVRStatus = {
  isPoweredOn: boolean;
  volume: number; // Raw Denon volume (0-99, with decimals like 50.5)
  isMuted: boolean;
  input: string;
  soundMode: string;
};

class DenonAVRService {
  private denonApi: DenonTelnetAPI | null = null;
  private httpApi: DenonAPI;
  private isConnected: boolean = false;
  private simulationMode: boolean = false;
  private ip: string;
  private port: number;
  private status: DenonAVRStatus = {
    isPoweredOn: false,
    volume: 0,
    isMuted: false,
    input: '',
    soundMode: ''
  };
  
  constructor() {
    // Read connection settings
    this.ip = process.env.DENON_AVR_IP || '192.168.50.98';
    this.port = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : 23;
    // HTTP API for fallback
    this.httpApi = createDenonAPIFromEnv();
    
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
      // Note: setupRealTimeMonitoring() will be called in init() after startMonitoring()
    } catch (error) {
      logger.warn('Failed to initialize Denon AVR Telnet API, simulation mode enabled', { error });
      this.simulationMode = true;
      this.isConnected = false;
    }
  }
  
  /**
   * Set up real-time monitoring event listeners
   */
  private setupRealTimeMonitoring(): void {
    if (!this.denonApi) {
      logger.warn('Cannot setup real-time monitoring: denonApi is null');
      return;
    }

    logger.info('Setting up Denon AVR real-time monitoring event listeners');

    // Listen for connection status changes
    this.denonApi.on('connectionChanged', (connected: boolean) => {
      this.isConnected = connected;
      logger.info('Denon AVR connection status changed', { connected });
    });

    // Listen for individual status changes and publish to GraphQL subscriptions
    this.denonApi.on('powerChanged', (isPoweredOn: boolean) => {
      this.status.isPoweredOn = isPoweredOn;
      this.publishStatusChange();
    });

    this.denonApi.on('volumeChanged', (volume: number) => {
      this.status.volume = volume;
      this.publishStatusChange();
    });

    this.denonApi.on('muteChanged', (isMuted: boolean) => {
      this.status.isMuted = isMuted;
      this.publishStatusChange();
    });

    this.denonApi.on('inputChanged', (input: string) => {
      this.status.input = input;
      this.publishStatusChange();
    });

    this.denonApi.on('soundModeChanged', (soundMode: string) => {
      this.status.soundMode = soundMode;
      this.publishStatusChange();
    });

    // Listen for complete status updates
    this.denonApi.on('statusUpdate', (newStatus) => {
      this.status = { ...newStatus };
      this.publishStatusChange();
    });
  }

  /**
   * Publish status changes to GraphQL subscriptions
   */
  private publishStatusChange(): void {
    try {
      const pubsub = (global as any).pubsub;
      if (pubsub) {
        pubsub.publish(DENON_AVR_STATUS_CHANNEL, { 
          denonAvrStatusChanged: this.status 
        });
        logger.debug('Published Denon AVR status change to GraphQL subscriptions', { status: this.status });
      }
    } catch (error) {
      logger.debug('Failed to publish Denon AVR status change', { error });
    }
  }
  
  /**
   * Initialize the AVR connection and start real-time monitoring
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
      // Try to get initial power state to test the connection
      const isPoweredOn = await this.denonApi.getPowerState();
      logger.info('Initial Denon AVR power state check', { isPoweredOn });
      
      // Get initial status using traditional polling method
      await this.refreshStatus(false);
      
      // Start real-time monitoring for future changes
      this.denonApi.startMonitoring();
      
      // Set up event listeners AFTER monitoring is started
      this.setupRealTimeMonitoring();
      
      this.isConnected = true;
      
      logger.info('Denon AVR connection initialized successfully with real-time monitoring', { status: this.status });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Denon AVR connection', { error });
      this.simulationMode = true;
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Stop real-time monitoring (replaces stopPolling)
   */
  stopMonitoring(): void {
    if (this.denonApi) {
      this.denonApi.stopMonitoring();
    }
  }
  
  /**
   * Refresh the AVR status (now only used for initial status or manual refresh)
   * Real-time updates come through the monitoring connection
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
      
      // Update status
      const newStatus = {
        isPoweredOn,
        volume: isPoweredOn ? volume : 0,
        isMuted: isPoweredOn ? isMuted : false,
        input: isPoweredOn ? input : '',
        soundMode: isPoweredOn ? soundMode : ''
      };
      
      this.status = newStatus;
      
      // Only log if there's an actual change or if not in silent mode
      const hasChanged = JSON.stringify(prevStatus) !== JSON.stringify(this.status);
      
      if (hasChanged) {
        logger.info('Denon AVR status refreshed with changes', { 
          previous: prevStatus,
          current: this.status
        });
        // Publish the change if it's not from real-time monitoring
        this.publishStatusChange();
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
    // If real-time monitoring is active, use cached status from monitoring
    if (this.denonApi?.isMonitoringActive()) {
      const cachedStatus = this.denonApi.getCachedStatus();
      // Update our status with the real-time cached status
      this.status = { ...cachedStatus };
    }
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
        case 'POWER_ON': {
          // Attempt Telnet power on
          let telnetSuccess = false;
          try {
            telnetSuccess = await this.denonApi.powerOn();
          } catch (err) {
            logger.warn('Telnet POWER_ON failed, falling back to HTTP powerOn', { error: err });
          }
          if (!telnetSuccess) {
            // Fallback to HTTP API
            logger.info('Falling back to HTTP API for POWER_ON');
            await this.httpApi.powerOn();
          }
          this.status.isPoweredOn = true;
          break;
        }
        case 'POWER_OFF':
          await this.denonApi.powerOff();
          this.status.isPoweredOn = false;
          break;
          
        case 'VOLUME_UP':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.volumeUp();
          // Don't update local status - let real-time monitoring handle it
          break;
          
        case 'VOLUME_DOWN':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.volumeDown();
          // Don't update local status - let real-time monitoring handle it
          break;
          
        case 'SET_VOLUME':
          if (!this.status.isPoweredOn || !value) return false;
          const volumeLevel = parseFloat(value);
          await this.denonApi.setVolume(volumeLevel);
          // Don't update local status - let real-time monitoring handle it
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
        this.status.volume = Math.min(99, this.status.volume + 0.5);
        break;
        
      case 'VOLUME_DOWN':
        if (!this.status.isPoweredOn) return;
        this.status.volume = Math.max(0, this.status.volume - 0.5);
        break;
        
      case 'SET_VOLUME':
        if (!this.status.isPoweredOn || !value) return;
        this.status.volume = parseFloat(value);
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

  /**
   * Check if AVR is reachable (TCP ping)
   */
  async isReachable(): Promise<boolean> {
    if (this.simulationMode) {
      return true;
    }
    return new Promise(resolve => {
      const socket = new net.Socket();
      let resolved = false;
      socket.setTimeout(500);
      socket.once('connect', () => {
        resolved = true;
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });
      socket.once('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });
      socket.connect(this.port, this.ip);
    });
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup(): void {
    logger.info('Cleaning up Denon AVR service');
    this.stopMonitoring();
    if (this.denonApi) {
      this.denonApi.removeAllListeners();
    }
  }
}

// Create a singleton instance of the service
export const denonAvrService = new DenonAVRService(); 