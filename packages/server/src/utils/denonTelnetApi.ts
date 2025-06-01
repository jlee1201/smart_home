import { logger } from './logger.js';
import net from 'net';
import { EventEmitter } from 'events';

// Type definitions for Denon AVR API via Telnet
export type DenonAVRConfig = {
  ip: string;
  port?: number;
  deviceName?: string;
  connectionTimeout?: number;
  commandTimeout?: number;
};

// Response from the AVR
export type DenonResponse = {
  success: boolean;
  data: string;
  error?: string;
};

// Event types for real-time status updates
export interface DenonStatusEvents {
  powerChanged: (isPoweredOn: boolean) => void;
  volumeChanged: (volume: number) => void;
  muteChanged: (isMuted: boolean) => void;
  inputChanged: (input: string) => void;
  soundModeChanged: (soundMode: string) => void;
  connectionChanged: (connected: boolean) => void;
  statusUpdate: (status: {
    isPoweredOn: boolean;
    volume: number;
    isMuted: boolean;
    input: string;
    soundMode: string;
  }) => void;
}

// Common Denon AVR commands for AVR-X4500H
export const DENON_COMMANDS = {
  // Power commands
  POWER_ON: 'PWON',
  POWER_OFF: 'PWSTANDBY',
  POWER_STATUS: 'PW?',
  
  // Volume commands
  VOLUME_UP: 'MVUP',
  VOLUME_DOWN: 'MVDOWN',
  VOLUME_STATUS: 'MV?',
  VOLUME_SET_PREFIX: 'MV',   // + value (00-99)
  
  // Mute commands
  MUTE_ON: 'MUON',
  MUTE_OFF: 'MUOFF',
  MUTE_TOGGLE: 'MUON MUOFF', // Not a real command, just shorthand for our API
  MUTE_STATUS: 'MU?',
  
  // Input selection commands
  INPUT_STATUS: 'SI?',
  INPUT_CBL_SAT: 'SICBL/SAT',
  INPUT_DVD: 'SIDVD',
  INPUT_BD: 'SIBD',
  INPUT_GAME: 'SIGAME',
  INPUT_AUX1: 'SIAUX1',
  INPUT_MEDIA_PLAYER: 'SIMPLAY',
  INPUT_TV: 'SITV',
  INPUT_TUNER: 'SITUNER',
  INPUT_PHONO: 'SIPHONO',
  INPUT_CD: 'SICD',
  INPUT_BLUETOOTH: 'SIBT',
  INPUT_NETWORK: 'SINET',
  
  // Sound mode commands
  SOUND_MODE_STATUS: 'MS?',
  SOUND_MOVIE: 'MSMOVIE',
  SOUND_MUSIC: 'MSMUSIC',
  SOUND_GAME: 'MSGAME',
  SOUND_DIRECT: 'MSDIRECT',
  SOUND_STEREO: 'MSSTEREO',
  SOUND_AUTO: 'MSAUTO',
  SOUND_DOLBY: 'MSDOLBY',
  SOUND_DTS: 'MSDTS',
  SOUND_MULTI: 'MSMULTI',
  
  // Zone 2 commands
  ZONE2_POWER_ON: 'Z2ON',
  ZONE2_POWER_OFF: 'Z2OFF',
  ZONE2_POWER_STATUS: 'Z2?',
  ZONE2_VOLUME_UP: 'Z2UP',
  ZONE2_VOLUME_DOWN: 'Z2DOWN',
  ZONE2_VOLUME_SET_PREFIX: 'Z2',  // + value (00-99)
  ZONE2_MUTE_ON: 'Z2MUON',
  ZONE2_MUTE_OFF: 'Z2MUOFF',
  ZONE2_MUTE_STATUS: 'Z2MU?',
  
  // Navigation commands
  MENU: 'MNMEN',
  UP: 'MNCUP',
  DOWN: 'MNCDN',
  LEFT: 'MNCLT',
  RIGHT: 'MNCRT',
  SELECT: 'MNENT',
  RETURN: 'MNRTN',
  HOME: 'MN',
  OPTION: 'MNOPT',
  INFO: 'MNINF',
  
  // Playback controls
  PLAY: 'NS9A',
  PAUSE: 'NS9B',
  STOP: 'NS9C',
  PREVIOUS: 'NS9E',
  NEXT: 'NS9D',
  FORWARD: 'NS9F',
  REVERSE: 'NS9G',
  
  // ECO mode
  ECO_AUTO: 'ECOAUTO',
  ECO_ON: 'ECOON',
  ECO_OFF: 'ECOOFF',
  ECO_STATUS: 'ECO?',
  
  // Sleep timer
  SLEEP_OFF: 'SLPOFF',
  SLEEP_30: 'SLP030',
  SLEEP_60: 'SLP060',
  SLEEP_90: 'SLP090',
  SLEEP_120: 'SLP120',
  SLEEP_STATUS: 'SLP?',
  
  // Advanced commands
  QUICK_SELECT_1: 'MSQUICK1',
  QUICK_SELECT_2: 'MSQUICK2',
  QUICK_SELECT_3: 'MSQUICK3',
  QUICK_SELECT_4: 'MSQUICK4',
  QUICK_SELECT_5: 'MSQUICK5',
  
  // Audyssey settings
  AUDYSSEY_ON: 'PSMULTEQ:ON',
  AUDYSSEY_OFF: 'PSMULTEQ:OFF',
  AUDYSSEY_STATUS: 'PSMULTEQ:?',
  DYNAMIC_EQ_ON: 'PSDYNEQ:ON',
  DYNAMIC_EQ_OFF: 'PSDYNEQ:OFF',
  DYNAMIC_EQ_STATUS: 'PSDYNEQ:?',
  DYNAMIC_VOL_HEAVY: 'PSDYNVOL:HEV',
  DYNAMIC_VOL_MEDIUM: 'PSDYNVOL:MED',
  DYNAMIC_VOL_LIGHT: 'PSDYNVOL:LIT',
  DYNAMIC_VOL_OFF: 'PSDYNVOL:OFF',
  DYNAMIC_VOL_STATUS: 'PSDYNVOL:?',
};

/**
 * DenonTelnetAPI - A class to interact with Denon AVR-X4500H via Telnet
 * Now supports both command/response and real-time event monitoring
 */
export class DenonTelnetAPI extends EventEmitter {
  private ip: string;
  private port: number;
  private connectionTimeout: number;
  private commandTimeout: number;
  private client: net.Socket | null = null;
  
  // Real-time monitoring
  private monitorClient: net.Socket | null = null;
  private isMonitoring: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Current status cache for change detection
  private lastKnownStatus = {
    isPoweredOn: false,
    volume: 0,
    isMuted: false,
    input: '',
    soundMode: ''
  };

  constructor(config: DenonAVRConfig) {
    super();
    this.ip = config.ip;
    this.port = config.port || 23; // Default Telnet port
    this.connectionTimeout = config.connectionTimeout || 5000; // 5 seconds
    this.commandTimeout = config.commandTimeout || 3000; // 3 seconds
  }

  /**
   * Start real-time monitoring of AVR status changes
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.debug('Denon AVR monitoring already active');
      return;
    }

    logger.info('Starting Denon AVR real-time monitoring');
    this.isMonitoring = true;
    this.reconnectAttempts = 0;
    this.connectMonitor();
  }

  /**
   * Stop real-time monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping Denon AVR real-time monitoring');
    this.isMonitoring = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.monitorClient) {
      this.monitorClient.removeAllListeners();
      this.monitorClient.destroy();
      this.monitorClient = null;
    }

    this.emit('connectionChanged', false);
  }

  /**
   * Connect the monitoring client for real-time updates
   */
  private connectMonitor(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitorClient) {
      this.monitorClient.removeAllListeners();
      this.monitorClient.destroy();
    }

    this.monitorClient = new net.Socket();
    this.monitorClient.setKeepAlive(true, 30000); // Keep connection alive

    // Set up event handlers
    this.monitorClient.on('connect', () => {
      logger.info('Denon AVR monitoring connection established');
      this.reconnectAttempts = 0;
      this.emit('connectionChanged', true);
      
      // Request initial status to populate cache
      this.requestInitialStatus();
    });

    this.monitorClient.on('data', (data) => {
      this.handleMonitorData(data.toString());
    });

    this.monitorClient.on('error', (error) => {
      logger.error('Denon AVR monitoring connection error', { error: error.message });
      this.emit('connectionChanged', false);
      this.scheduleReconnect();
    });

    this.monitorClient.on('close', () => {
      logger.warn('Denon AVR monitoring connection closed');
      this.emit('connectionChanged', false);
      if (this.isMonitoring) {
        this.scheduleReconnect();
      }
    });

    this.monitorClient.on('timeout', () => {
      logger.warn('Denon AVR monitoring connection timeout');
      this.monitorClient?.destroy();
    });

    // Connect with timeout
    const connectTimeout = setTimeout(() => {
      if (this.monitorClient && !this.monitorClient.destroyed) {
        logger.error('Denon AVR monitoring connection timeout');
        this.monitorClient.destroy();
      }
    }, this.connectionTimeout);

    this.monitorClient.connect(this.port, this.ip, () => {
      clearTimeout(connectTimeout);
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.isMonitoring || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(`Denon AVR monitoring: Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
        this.stopMonitoring();
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts; // Exponential backoff

    logger.info(`Denon AVR monitoring: Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connectMonitor();
    }, delay);
  }

  /**
   * Request initial status when monitoring connection is established
   */
  private requestInitialStatus(): void {
    if (!this.monitorClient || this.monitorClient.destroyed) {
      return;
    }

    // Send status queries to get initial state
    const queries = [
      DENON_COMMANDS.POWER_STATUS,
      DENON_COMMANDS.VOLUME_STATUS,
      DENON_COMMANDS.MUTE_STATUS,
      DENON_COMMANDS.INPUT_STATUS,
      DENON_COMMANDS.SOUND_MODE_STATUS
    ];

    queries.forEach((query, index) => {
      setTimeout(() => {
        if (this.monitorClient && !this.monitorClient.destroyed) {
          this.monitorClient.write(`${query}\r`);
        }
      }, index * 100); // Stagger requests to avoid overwhelming the device
    });
  }

  /**
   * Handle incoming data from the monitoring connection
   */
  private handleMonitorData(data: string): void {
    const lines = data.split(/[\r\n]+/).filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      this.parseStatusUpdate(line.trim());
    }
  }

  /**
   * Parse a status update line and emit appropriate events
   */
  private parseStatusUpdate(line: string): void {
    logger.debug('Denon AVR status update received', { line });

    let hasChanges = false;
    const newStatus = { ...this.lastKnownStatus };

    // Parse power status
    if (line === 'PWON') {
      if (!this.lastKnownStatus.isPoweredOn) {
        newStatus.isPoweredOn = true;
        hasChanges = true;
        this.emit('powerChanged', true);
        logger.info('Denon AVR powered ON (real-time)');
      }
    } else if (line === 'PWSTANDBY') {
      if (this.lastKnownStatus.isPoweredOn) {
        newStatus.isPoweredOn = false;
        hasChanges = true;
        this.emit('powerChanged', false);
        logger.info('Denon AVR powered OFF (real-time)');
      }
    }

    // Parse volume
    const volumeMatch = line.match(/^MV(\d+)$/);
    if (volumeMatch) {
      const volumeStr = volumeMatch[1];
      let rawVolume: number;
      
      if (volumeStr.length >= 3) {
        // Format like MV505 = 50.5
        rawVolume = parseInt(volumeStr.slice(0, -1)) + (parseInt(volumeStr.slice(-1)) / 10);
      } else {
        // Format like MV50 = 50
        rawVolume = parseInt(volumeStr);
      }

      if (rawVolume !== this.lastKnownStatus.volume) {
        newStatus.volume = rawVolume;
        hasChanges = true;
        this.emit('volumeChanged', rawVolume);
        logger.info('Denon AVR volume changed (real-time)', { 
          volume: rawVolume 
        });
      }
    }

    // Parse mute status
    if (line === 'MUON') {
      if (!this.lastKnownStatus.isMuted) {
        newStatus.isMuted = true;
        hasChanges = true;
        this.emit('muteChanged', true);
        logger.info('Denon AVR muted (real-time)');
      }
    } else if (line === 'MUOFF') {
      if (this.lastKnownStatus.isMuted) {
        newStatus.isMuted = false;
        hasChanges = true;
        this.emit('muteChanged', false);
        logger.info('Denon AVR unmuted (real-time)');
      }
    }

    // Parse input
    const inputMatch = line.match(/^SI(.+)$/);
    if (inputMatch) {
      const input = inputMatch[1];
      if (input !== this.lastKnownStatus.input) {
        newStatus.input = input;
        hasChanges = true;
        this.emit('inputChanged', input);
        logger.info('Denon AVR input changed (real-time)', { input });
      }
    }

    // Parse sound mode
    const soundModeMatch = line.match(/^MS(.+)$/);
    if (soundModeMatch) {
      const soundMode = soundModeMatch[1];
      if (soundMode !== this.lastKnownStatus.soundMode) {
        newStatus.soundMode = soundMode;
        hasChanges = true;
        this.emit('soundModeChanged', soundMode);
        logger.info('Denon AVR sound mode changed (real-time)', { soundMode });
      }
    }

    // If any changes occurred, update cache and emit general status update
    if (hasChanges) {
      this.lastKnownStatus = newStatus;
      this.emit('statusUpdate', newStatus);
    }
  }

  /**
   * Get the current cached status (from real-time monitoring)
   */
  getCachedStatus() {
    return { ...this.lastKnownStatus };
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring && this.monitorClient !== null && !this.monitorClient.destroyed;
  }

  /**
   * Send a command to the AVR via Telnet with automatic retry
   */
  async sendCommand(command: string, retryCount = 2): Promise<DenonResponse> {
    return new Promise((resolve) => {
      const executeCommand = async (attemptsLeft: number) => {
        const timeoutId = setTimeout(() => {
          // Close the connection if no response in time
          if (this.client) {
            this.client.destroy();
            this.client = null;
          }
          
          if (attemptsLeft > 0) {
            logger.warn(`Denon AVR command "${command}" timed out, retrying... (${attemptsLeft} attempts left)`);
            executeCommand(attemptsLeft - 1);
          } else {
            logger.error(`Denon AVR command "${command}" failed after all retry attempts`);
            resolve({
              success: false,
              data: '',
              error: 'Connection timeout after all retries'
            });
          }
        }, this.commandTimeout);
        
        let responseData = '';
        let lastDataTime = 0;
        let dataReceived = false;
        
        try {
          if (this.client) {
            // Close any existing connection first
            this.client.destroy();
            this.client = null;
          }
          
          this.client = new net.Socket();
          
          // Set up event handlers
          this.client.on('data', (data) => {
            const chunk = data.toString();
            responseData += chunk;
            lastDataTime = Date.now();
            dataReceived = true;
            
            // Only log important or unexpected responses
            if (command.includes('?') || chunk.includes('ERR')) {
              logger.debug(`Denon response for "${command}": "${chunk.trim()}"`);
            }
          });
          
          this.client.on('close', () => {
            clearTimeout(timeoutId);
            
            // If we didn't receive any data and have retries left, try again
            if (!dataReceived && attemptsLeft > 0) {
              logger.warn(`No data received for command "${command}", retrying... (${attemptsLeft} attempts left)`);
              executeCommand(attemptsLeft - 1);
              return;
            }
            
            // Only log the full response at debug level if it's a query or contains an error
            if (command.includes('?') || responseData.includes('ERR')) {
              logger.debug(`Denon AVR full response for "${command}": "${responseData.trim()}"`);
            }
            
            resolve({
              success: dataReceived, // Only consider success if we got data
              data: responseData.trim()
            });
          });
          
          this.client.on('error', (error) => {
            clearTimeout(timeoutId);
            logger.error(`Error communicating with Denon AVR via Telnet for command "${command}"`, { error });
            
            if (this.client) {
              this.client.destroy();
              this.client = null;
            }
            
            if (attemptsLeft > 0) {
              logger.warn(`Retrying command "${command}" after error... (${attemptsLeft} attempts left)`);
              executeCommand(attemptsLeft - 1);
            } else {
              resolve({
                success: false,
                data: '',
                error: error.message
              });
            }
          });
          
          // Connect to the AVR
          this.client.connect(this.port, this.ip, () => {
            // Only log at debug level
            logger.debug(`Sending Denon command: "${command}"`);
            
            // Send the command with carriage return
            this.client!.write(`${command}\r`);
            
            // Wait for a response with a dynamic timeout
            // Denon receivers can sometimes take a moment to respond fully
            const waitForFullResponse = () => {
              const now = Date.now();
              const timeSinceLastData = now - lastDataTime;
              
              // If we've received data and nothing new for 500ms, assume we're done
              if (responseData.length > 0 && timeSinceLastData > 500) {
                if (this.client) {
                  this.client.end();
                }
              } else {
                // If we're still waiting for data or getting data, check again in 100ms
                setTimeout(waitForFullResponse, 100);
              }
            };
            
            // Start the response wait timer
            lastDataTime = Date.now();
            waitForFullResponse();
          });
        } catch (error) {
          clearTimeout(timeoutId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          logger.error(`Error in Telnet connection to Denon AVR for command "${command}"`, { error: errorMessage });
          
          if (this.client) {
            this.client.destroy();
            this.client = null;
          }
          
          if (attemptsLeft > 0) {
            logger.warn(`Retrying command "${command}" after exception... (${attemptsLeft} attempts left)`);
            executeCommand(attemptsLeft - 1);
          } else {
            resolve({
              success: false,
              data: '',
              error: errorMessage
            });
          }
        }
      };
      
      // Start the execution with initial retry count
      executeCommand(retryCount);
    });
  }
  
  /**
   * Get current power state with reliable detection
   */
  async getPowerState(): Promise<boolean> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.POWER_STATUS);
      
      // Log the raw response for debugging
      logger.debug('Raw power state response', { data: response.data });
      
      // If we didn't get a successful response or got empty data, retry with a longer timeout
      if (!response.success || !response.data) {
        logger.warn('Empty or failed power state response, retrying with extended timeout');
        
        // Create a one-off socket with longer timeout
        return new Promise((resolve) => {
          const client = new net.Socket();
          let responseData = '';
          let timeoutId: NodeJS.Timeout;
          
          // Set a longer timeout for power state queries
          timeoutId = setTimeout(() => {
            client.destroy();
            logger.error('Extended power state query timed out');
            resolve(false);
          }, 10000); // 10 second timeout
          
          client.on('data', (data) => {
            responseData += data.toString();
            logger.debug('Extended power query chunk:', { data: data.toString().trim() });
          });
          
          client.on('close', () => {
            clearTimeout(timeoutId);
            
            // Same logic as before
            const lines = responseData.split(/[\r\n]+/).map(line => line.trim());
            const hasPwOnLine = lines.some(line => line === 'PWON' || line.startsWith('PWON'));
            const containsPwOn = responseData.includes('PWON');
            const isPoweredOn = hasPwOnLine || containsPwOn;
            
            logger.info('Extended power state check result', { 
              isPoweredOn, 
              response: responseData.trim()
            });
            
            resolve(isPoweredOn);
          });
          
          client.on('error', (error) => {
            clearTimeout(timeoutId);
            logger.error('Error in extended power state check', { error });
            resolve(false);
          });
          
          client.connect(this.port, this.ip, () => {
            logger.debug('Connected for extended power state check');
            client.write(`${DENON_COMMANDS.POWER_STATUS}\r`);
            
            // Wait longer for response
            setTimeout(() => {
              client.end();
            }, 3000);
          });
        });
      }
      
      // Split the response by line to find PWON more reliably
      const lines = response.data.split(/[\r\n]+/).map(line => line.trim());
      
      // Check if any line contains PWON (more reliable than checking the whole string)
      const hasPwOnLine = lines.some(line => line === 'PWON' || line.startsWith('PWON'));
      
      // Fallback: check if PWON appears anywhere in the response
      const containsPwOn = response.data.includes('PWON');
      
      const isPoweredOn = response.success && (hasPwOnLine || containsPwOn);
      
      logger.info('Denon AVR power state result', { 
        isPoweredOn, 
        hasPwOnLine,
        containsPwOn,
        responseLines: lines 
      });
      
      return isPoweredOn;
    } catch (error) {
      logger.error('Error getting Denon AVR power state via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Turn power on
   */
  async powerOn(): Promise<boolean> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.POWER_ON);
      return response.success;
    } catch (error) {
      logger.error('Error powering on Denon AVR via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Turn power off (standby)
   */
  async powerOff(): Promise<boolean> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.POWER_OFF);
      return response.success;
    } catch (error) {
      logger.error('Error powering off Denon AVR via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get current volume level (0-100) with improved parsing
   */
  async getVolume(): Promise<number> {
    try {
      // Check power state first
      const isPoweredOn = await this.getPowerState();
      if (!isPoweredOn) {
        logger.debug('Cannot get volume - Denon AVR is powered off');
        return 0;
      }
      
      // Try up to 3 times to get a valid volume response
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        
        const response = await this.sendCommand(DENON_COMMANDS.VOLUME_STATUS);
        logger.debug('Raw volume response', { data: response.data });
        
        if (response.success && response.data) {
          // Split the response into lines
          const lines = response.data.split(/[\r\n]+/).map(line => line.trim());
          
          // Try multiple methods to find volume value
          
          // Method 1: Find line that starts with MV followed by digits
          const mvLine = lines.find(line => /^MV\d+$/.test(line));
          
          if (mvLine) {
            const volumeValue = parseInt(mvLine.replace('MV', ''), 10);
            
            // For values like 515, interpret as 51.5
            const normalizedVolume = volumeValue > 100 
              ? Math.round(volumeValue / 10) 
              : volumeValue;
            
            logger.debug('Denon AVR volume parsed successfully', {
              volumeValue,
              normalized: normalizedVolume
            });
            
            return normalizedVolume;
          }
          
          // Method 2: Use regex to find MV followed by digits anywhere in response
          const volumeMatch = response.data.match(/MV(\d+)/);
          if (volumeMatch && volumeMatch[1]) {
            const volumeValue = parseInt(volumeMatch[1], 10);
            
            // For values like 515, interpret as 51.5
            const normalizedVolume = volumeValue > 100 
              ? Math.round(volumeValue / 10) 
              : volumeValue;
            
            logger.debug('Denon AVR volume parsed using regex', {
              volumeValue,
              normalized: normalizedVolume
            });
            
            return normalizedVolume;
          }
        }
        
        if (attempts < maxAttempts) {
          logger.warn(`Failed to parse volume response, attempt ${attempts}/${maxAttempts}`);
        }
      }
      
      logger.warn('Could not parse Denon AVR volume after multiple attempts');
      return 0;
    } catch (error) {
      logger.error('Error getting Denon AVR volume via Telnet', { error });
      return 0;
    }
  }
  
  /**
   * Set volume level (0-99, with decimals like 50.5)
   */
  async setVolume(level: number): Promise<boolean> {
    try {
      // Clamp to valid Denon range (0-99)
      const volume = Math.min(99, Math.max(0, level));
      
      // Format for Denon command
      let volumeCommand: string;
      if (volume % 1 === 0) {
        // Whole number: format as two digits (e.g., 50 -> MV50)
        volumeCommand = `${DENON_COMMANDS.VOLUME_SET_PREFIX}${Math.round(volume).toString().padStart(2, '0')}`;
      } else {
        // Decimal: format as three digits (e.g., 50.5 -> MV505)
        const wholePart = Math.floor(volume);
        const decimalPart = Math.round((volume - wholePart) * 10);
        volumeCommand = `${DENON_COMMANDS.VOLUME_SET_PREFIX}${wholePart.toString().padStart(2, '0')}${decimalPart}`;
      }
      
      const response = await this.sendCommand(volumeCommand);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR volume via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Increase volume
   */
  async volumeUp(): Promise<boolean> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.VOLUME_UP);
      return response.success;
    } catch (error) {
      logger.error('Error increasing Denon AVR volume via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Decrease volume
   */
  async volumeDown(): Promise<boolean> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.VOLUME_DOWN);
      return response.success;
    } catch (error) {
      logger.error('Error decreasing Denon AVR volume via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get mute status
   */
  async getMuteState(): Promise<boolean> {
    try {
      // First check if device is powered on
      const isPoweredOn = await this.getPowerState();
      if (!isPoweredOn) {
        logger.debug('Cannot get mute state - Denon AVR is powered off');
        return false;
      }
      
      const response = await this.sendCommand(DENON_COMMANDS.MUTE_STATUS);
      
      // The response should be MUON or MUOFF
      const isMuted = response.success && response.data.includes('MUON');
      
      logger.debug('Denon AVR mute state', { isMuted });
      return isMuted;
    } catch (error) {
      logger.error('Error getting Denon AVR mute state via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Set mute state
   */
  async setMute(mute: boolean): Promise<boolean> {
    try {
      const command = mute ? DENON_COMMANDS.MUTE_ON : DENON_COMMANDS.MUTE_OFF;
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR mute state via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Toggle mute
   */
  async toggleMute(): Promise<boolean> {
    try {
      const isMuted = await this.getMuteState();
      return await this.setMute(!isMuted);
    } catch (error) {
      logger.error('Error toggling Denon AVR mute state via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get current input source
   */
  async getCurrentInput(): Promise<string> {
    try {
      // First check if device is powered on
      const isPoweredOn = await this.getPowerState();
      if (!isPoweredOn) {
        logger.debug('Cannot get input - Denon AVR is powered off');
        return '';
      }
      
      const response = await this.sendCommand(DENON_COMMANDS.INPUT_STATUS);
      
      if (response.success) {
        // The response may contain multiple lines, find the one starting with SI
        const lines = response.data.split(/[\r\n]+/).map(line => line.trim());
        const siLine = lines.find(line => line.startsWith('SI'));
        
        if (siLine) {
          // Extract input name (remove 'SI' prefix)
          return siLine.substring(2);
        }
        
        // Fallback to regex
        const inputMatch = response.data.match(/SI(.+?)(\s|$)/);
        if (inputMatch && inputMatch[1]) {
          return inputMatch[1];
        }
        
        logger.warn('Could not parse Denon AVR input response', { rawResponse: response.data });
      }
      
      return '';
    } catch (error) {
      logger.error('Error getting Denon AVR input via Telnet', { error });
      return '';
    }
  }
  
  /**
   * Set input source
   */
  async setInput(input: string): Promise<boolean> {
    try {
      // Normalize input name
      const normalizedInput = input.toUpperCase().replace('_', '/');
      
      // Use a predefined command if available
      let command = '';
      
      // Check if input matches any of our defined input commands
      for (const [key, value] of Object.entries(DENON_COMMANDS)) {
        if (key.startsWith('INPUT_') && key !== 'INPUT_STATUS') {
          const inputName = key.replace('INPUT_', '');
          if (normalizedInput === inputName || normalizedInput === value.replace('SI', '')) {
            command = value;
            break;
          }
        }
      }
      
      // If no matching command found, try to construct it
      if (!command) {
        command = `SI${normalizedInput}`;
      }
      
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR input via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get current sound mode
   */
  async getSoundMode(): Promise<string> {
    try {
      // First check if device is powered on
      const isPoweredOn = await this.getPowerState();
      if (!isPoweredOn) {
        logger.debug('Cannot get sound mode - Denon AVR is powered off');
        return '';
      }
      
      const response = await this.sendCommand(DENON_COMMANDS.SOUND_MODE_STATUS);
      
      if (response.success) {
        // The response may contain multiple lines, find the one starting with MS
        const lines = response.data.split(/[\r\n]+/).map(line => line.trim());
        const msLine = lines.find(line => line.startsWith('MS'));
        
        if (msLine) {
          // Extract sound mode (remove 'MS' prefix)
          return msLine.substring(2);
        }
        
        // Fallback to regex
        const modeMatch = response.data.match(/MS(.+?)(\s|$)/);
        if (modeMatch && modeMatch[1]) {
          return modeMatch[1];
        }
        
        logger.warn('Could not parse Denon AVR sound mode response', { rawResponse: response.data });
      }
      
      return '';
    } catch (error) {
      logger.error('Error getting Denon AVR sound mode via Telnet', { error });
      return '';
    }
  }
  
  /**
   * Set sound mode
   */
  async setSoundMode(mode: string): Promise<boolean> {
    try {
      // Normalize mode name
      const normalizedMode = mode.toUpperCase();
      
      // Use a predefined command if available
      let command = '';
      
      // Check if mode matches any of our defined sound mode commands
      for (const [key, value] of Object.entries(DENON_COMMANDS)) {
        if (key.startsWith('SOUND_') && key !== 'SOUND_MODE_STATUS') {
          const modeName = key.replace('SOUND_', '');
          if (normalizedMode === modeName || normalizedMode === value.replace('MS', '')) {
            command = value;
            break;
          }
        }
      }
      
      // If no matching command found, try to construct it
      if (!command) {
        command = `MS${normalizedMode}`;
      }
      
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR sound mode via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Send navigation command
   */
  async navigate(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT' | 'MENU' | 'RETURN' | 'HOME' | 'OPTION' | 'INFO'): Promise<boolean> {
    try {
      let command = '';
      
      switch (direction) {
        case 'UP':
          command = DENON_COMMANDS.UP;
          break;
        case 'DOWN':
          command = DENON_COMMANDS.DOWN;
          break;
        case 'LEFT':
          command = DENON_COMMANDS.LEFT;
          break;
        case 'RIGHT':
          command = DENON_COMMANDS.RIGHT;
          break;
        case 'SELECT':
          command = DENON_COMMANDS.SELECT;
          break;
        case 'MENU':
          command = DENON_COMMANDS.MENU;
          break;
        case 'RETURN':
          command = DENON_COMMANDS.RETURN;
          break;
        case 'HOME':
          command = DENON_COMMANDS.HOME;
          break;
        case 'OPTION':
          command = DENON_COMMANDS.OPTION;
          break;
        case 'INFO':
          command = DENON_COMMANDS.INFO;
          break;
        default:
          return false;
      }
      
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error sending Denon AVR navigation command via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Send playback control command
   */
  async playbackControl(command: 'PLAY' | 'PAUSE' | 'STOP' | 'PREVIOUS' | 'NEXT' | 'FORWARD' | 'REVERSE'): Promise<boolean> {
    try {
      let cmdString = '';
      
      switch (command) {
        case 'PLAY':
          cmdString = DENON_COMMANDS.PLAY;
          break;
        case 'PAUSE':
          cmdString = DENON_COMMANDS.PAUSE;
          break;
        case 'STOP':
          cmdString = DENON_COMMANDS.STOP;
          break;
        case 'PREVIOUS':
          cmdString = DENON_COMMANDS.PREVIOUS;
          break;
        case 'NEXT':
          cmdString = DENON_COMMANDS.NEXT;
          break;
        case 'FORWARD':
          cmdString = DENON_COMMANDS.FORWARD;
          break;
        case 'REVERSE':
          cmdString = DENON_COMMANDS.REVERSE;
          break;
        default:
          return false;
      }
      
      const response = await this.sendCommand(cmdString);
      return response.success;
    } catch (error) {
      logger.error('Error sending Denon AVR playback command via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Set ECO mode
   */
  async setEcoMode(mode: 'AUTO' | 'ON' | 'OFF'): Promise<boolean> {
    try {
      let command = '';
      
      switch (mode) {
        case 'AUTO':
          command = DENON_COMMANDS.ECO_AUTO;
          break;
        case 'ON':
          command = DENON_COMMANDS.ECO_ON;
          break;
        case 'OFF':
          command = DENON_COMMANDS.ECO_OFF;
          break;
        default:
          return false;
      }
      
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR ECO mode via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get ECO mode status
   */
  async getEcoMode(): Promise<string> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.ECO_STATUS);
      
      if (response.success) {
        if (response.data.includes('ECOAUTO')) return 'AUTO';
        if (response.data.includes('ECOON')) return 'ON';
        if (response.data.includes('ECOOFF')) return 'OFF';
      }
      
      return '';
    } catch (error) {
      logger.error('Error getting Denon AVR ECO mode via Telnet', { error });
      return '';
    }
  }
  
  /**
   * Set sleep timer
   * @param minutes Minutes for sleep timer (0, 30, 60, 90, 120), 0 means off
   */
  async setSleepTimer(minutes: 0 | 30 | 60 | 90 | 120): Promise<boolean> {
    try {
      let command = '';
      
      switch (minutes) {
        case 0:
          command = DENON_COMMANDS.SLEEP_OFF;
          break;
        case 30:
          command = DENON_COMMANDS.SLEEP_30;
          break;
        case 60:
          command = DENON_COMMANDS.SLEEP_60;
          break;
        case 90:
          command = DENON_COMMANDS.SLEEP_90;
          break;
        case 120:
          command = DENON_COMMANDS.SLEEP_120;
          break;
        default:
          return false;
      }
      
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR sleep timer via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get sleep timer status
   * @returns Minutes for sleep timer (0, 30, 60, 90, 120), 0 means off
   */
  async getSleepTimer(): Promise<number> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.SLEEP_STATUS);
      
      if (response.success) {
        if (response.data.includes('SLPOFF')) return 0;
        
        const sleepMatch = response.data.match(/SLP(\d+)/);
        if (sleepMatch && sleepMatch[1]) {
          return parseInt(sleepMatch[1], 10);
        }
      }
      
      return 0;
    } catch (error) {
      logger.error('Error getting Denon AVR sleep timer via Telnet', { error });
      return 0;
    }
  }
  
  /**
   * Select Quick Select preset
   * @param preset Preset number (1-5)
   */
  async quickSelect(preset: 1 | 2 | 3 | 4 | 5): Promise<boolean> {
    try {
      let command = '';
      
      switch (preset) {
        case 1:
          command = DENON_COMMANDS.QUICK_SELECT_1;
          break;
        case 2:
          command = DENON_COMMANDS.QUICK_SELECT_2;
          break;
        case 3:
          command = DENON_COMMANDS.QUICK_SELECT_3;
          break;
        case 4:
          command = DENON_COMMANDS.QUICK_SELECT_4;
          break;
        case 5:
          command = DENON_COMMANDS.QUICK_SELECT_5;
          break;
        default:
          return false;
      }
      
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR quick select via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Control Zone 2 power
   * @param powered Whether Zone 2 should be powered on
   */
  async setZone2Power(powered: boolean): Promise<boolean> {
    try {
      const command = powered ? DENON_COMMANDS.ZONE2_POWER_ON : DENON_COMMANDS.ZONE2_POWER_OFF;
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR Zone 2 power via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Get Zone 2 power status
   */
  async getZone2Power(): Promise<boolean> {
    try {
      const response = await this.sendCommand(DENON_COMMANDS.ZONE2_POWER_STATUS);
      return response.success && response.data.includes('Z2ON');
    } catch (error) {
      logger.error('Error getting Denon AVR Zone 2 power status via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Control Zone 2 volume
   * @param level Volume level (0-98, raw Denon value)
   */
  async setZone2Volume(level: number): Promise<boolean> {
    try {
      // Clamp to valid Denon Zone 2 range (0-98)
      const volume = Math.min(98, Math.max(0, level));
      
      // Format as two digits
      const volumeCommand = `${DENON_COMMANDS.ZONE2_VOLUME_SET_PREFIX}${Math.round(volume).toString().padStart(2, '0')}`;
      
      const response = await this.sendCommand(volumeCommand);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR Zone 2 volume via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Control Zone 2 mute
   * @param muted Whether Zone 2 should be muted
   */
  async setZone2Mute(muted: boolean): Promise<boolean> {
    try {
      const command = muted ? DENON_COMMANDS.ZONE2_MUTE_ON : DENON_COMMANDS.ZONE2_MUTE_OFF;
      const response = await this.sendCommand(command);
      return response.success;
    } catch (error) {
      logger.error('Error setting Denon AVR Zone 2 mute via Telnet', { error });
      return false;
    }
  }
  
  /**
   * Run a diagnostic check on the AVR connection and commands
   * This is a helper method for troubleshooting
   */
  async runDiagnostics(): Promise<{
    connected: boolean;
    powerState: boolean;
    volumeData: { raw: string; parsed: number | null; };
    muteData: { raw: string; parsed: boolean | null; };
    inputData: { raw: string; parsed: string | null; };
    issues: string[];
  }> {
    const issues: string[] = [];
    const result = {
      connected: false,
      powerState: false,
      volumeData: { raw: '', parsed: null as number | null },
      muteData: { raw: '', parsed: null as boolean | null },
      inputData: { raw: '', parsed: null as string | null },
      issues
    };
    
    try {
      // Test basic connection
      const client = new net.Socket();
      result.connected = await new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          client.destroy();
          issues.push('Connection timeout');
          resolve(false);
        }, this.connectionTimeout);
        
        client.on('connect', () => {
          clearTimeout(timeoutId);
          client.destroy();
          resolve(true);
        });
        
        client.on('error', (error) => {
          clearTimeout(timeoutId);
          client.destroy();
          issues.push(`Connection error: ${error.message}`);
          resolve(false);
        });
        
        client.connect(this.port, this.ip);
      });
      
      if (!result.connected) {
        logger.error('Diagnostics: Failed to connect to AVR');
        return result;
      }
      
      // Test power state
      const powerResponse = await this.sendCommand(DENON_COMMANDS.POWER_STATUS, 1);
      result.powerState = powerResponse.data.includes('PWON');
      
      if (!powerResponse.success || !powerResponse.data) {
        issues.push('Failed to get power state response');
      }
      
      // Test volume - use raw command to get full response
      const volumeResponse = await this.sendCommand(DENON_COMMANDS.VOLUME_STATUS, 1);
      result.volumeData.raw = volumeResponse.data;
      
      if (!volumeResponse.success || !volumeResponse.data) {
        issues.push('Failed to get volume response');
      } else {
        try {
          // Try different parsing methods
          let volumeValue = null;
          
          // Method 1: Find line that starts with MV followed by digits
          const mvLines = volumeResponse.data.split(/[\r\n]+/)
            .map(line => line.trim())
            .filter(line => /^MV\d+$/.test(line));
            
          if (mvLines.length > 0) {
            volumeValue = parseInt(mvLines[0].replace('MV', ''), 10);
          } else {
            // Method 2: Use regex to find MV followed by digits
            const volumeMatch = volumeResponse.data.match(/MV(\d+)/);
            if (volumeMatch && volumeMatch[1]) {
              volumeValue = parseInt(volumeMatch[1], 10);
            }
          }
          
          if (volumeValue !== null) {
            // For values like 515, interpret as 51.5
            const normalizedVolume = volumeValue > 100 
              ? Math.round(volumeValue / 10) 
              : volumeValue;
              
            result.volumeData.parsed = normalizedVolume;
          } else {
            issues.push('Failed to parse volume value from response');
          }
        } catch (error) {
          issues.push(`Volume parsing error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Test mute state
      const muteResponse = await this.sendCommand(DENON_COMMANDS.MUTE_STATUS, 1);
      result.muteData.raw = muteResponse.data;
      
      if (!muteResponse.success || !muteResponse.data) {
        issues.push('Failed to get mute state response');
      } else {
        result.muteData.parsed = muteResponse.data.includes('MUON');
      }
      
      // Test input
      const inputResponse = await this.sendCommand(DENON_COMMANDS.INPUT_STATUS, 1);
      result.inputData.raw = inputResponse.data;
      
      if (!inputResponse.success || !inputResponse.data) {
        issues.push('Failed to get input response');
      } else {
        try {
          // Extract input name
          const inputMatch = inputResponse.data.match(/SI(.+?)(\s|$|\r|\n)/);
          if (inputMatch && inputMatch[1]) {
            result.inputData.parsed = inputMatch[1];
          } else {
            issues.push('Failed to parse input value from response');
          }
        } catch (error) {
          issues.push(`Input parsing error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      issues.push(`Diagnostic error: ${errorMessage}`);
      logger.error('Error running Denon AVR diagnostics', { error });
      return result;
    }
  }
}

/**
 * Create DenonTelnetAPI instance from environment variables
 */
export function createDenonTelnetAPIFromEnv(): DenonTelnetAPI {
  const ip = process.env.DENON_AVR_IP;
  const port = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : 23;
  
  if (!ip) {
    throw new Error('DENON_AVR_IP environment variable must be set');
  }
  
  return new DenonTelnetAPI({
    ip,
    port,
    deviceName: process.env.DENON_AVR_DEVICE_NAME || 'SmartHome Controller'
  });
} 