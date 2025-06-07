import { DenonTelnetAPI, DENON_COMMANDS } from '../utils/denonTelnetApi.js';
import { logger } from '../utils/logger.js';
import { DENON_AVR_STATUS_CHANNEL } from '../resolvers.js';

import { createDenonAPIFromEnv } from '../utils/denonApi.js';
import type { DenonAPI } from '../utils/denonApi.js';
import { scanForAVRDevices } from '../utils/networkDiscovery.js';
import { validateMultipleAVRCandidates, validateAVRDevice } from '../utils/avrValidator.js';
import {
  getCurrentAVRSettings,
  upsertAVRSettings,
  addDiscoveryHistory,
  recordFailedConnection,
  initializeAVRSettingsFromEnv,
} from '../utils/avrDatabase.js';

export type DenonAVRStatus = {
  isPoweredOn: boolean;
  volume: number; // Raw Denon volume (0-99, with decimals like 50.5)
  isMuted: boolean;
  input: string;
  soundMode: string;
};

class DenonAVRService {
  private denonApi: DenonTelnetAPI | null = null;
  private httpApi: DenonAPI | null;
  private isConnected: boolean = false;
  private simulationMode: boolean = false;
  private ip: string;
  private port: number;
  private lastDiscoveryTime: number = 0;
  private discoveryInProgress: boolean = false;
  private readonly minDiscoveryInterval: number = 60000; // 1 minute minimum between discoveries
  private status: DenonAVRStatus = {
    isPoweredOn: false,
    volume: 0,
    isMuted: false,
    input: '',
    soundMode: '',
  };

  constructor() {
    // Initialize with default values - actual IP/port will be loaded from database or discovered
    this.ip = process.env.DENON_AVR_IP || '192.168.50.98';
    this.port = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : 23;
    // HTTP API for fallback (may be null if no env vars set)
    this.httpApi = createDenonAPIFromEnv();

    // Set default values for simulation mode
    this.status = {
      isPoweredOn: false,
      volume: 0,
      isMuted: false,
      input: '',
      soundMode: '',
    };

    // Check if AVR connection is enabled
    this.simulationMode = process.env.ENABLE_AVR_CONNECTION !== 'true';

    if (this.simulationMode) {
      logger.info('Denon AVR Service running in simulation mode - no real AVR will be contacted');
      this.isConnected = false;
      return;
    }

    // Note: Telnet API will be initialized in init() after discovery
    logger.info('Denon AVR Service initialized - will discover/connect during init()');
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

      // If disconnected, trigger rediscovery after a delay
      if (!connected && !this.simulationMode) {
        logger.info('Connection lost, will attempt rediscovery in 30 seconds');
        setTimeout(() => this.handleConnectionLoss(), 30000);
      }
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
    this.denonApi.on('statusUpdate', newStatus => {
      this.status = { ...newStatus };
      this.publishStatusChange();
    });
  }

  /**
   * Handle connection loss by attempting rediscovery
   */
  private async handleConnectionLoss(): Promise<void> {
    if (this.isConnected || this.simulationMode || this.discoveryInProgress) {
      return; // Connection restored or discovery already in progress
    }

    logger.info('Attempting to rediscover AVR after connection loss');

    const connection = await this.discoverAndConnect();
    if (connection && (connection.ip !== this.ip || connection.port !== this.port)) {
      logger.info('AVR rediscovered at new location, reinitializing', {
        oldIp: this.ip,
        oldPort: this.port,
        newIp: connection.ip,
        newPort: connection.port,
      });

      // Stop old monitoring
      if (this.denonApi) {
        this.denonApi.stopMonitoring();
      }

      // Update connection details and reinitialize
      this.ip = connection.ip;
      this.port = connection.port;
      await this.initializeWithConnection();
    }
  }

  /**
   * Publish status changes to GraphQL subscriptions
   */
  private publishStatusChange(): void {
    try {
      const pubsub = (global as any).pubsub;
      if (pubsub) {
        pubsub.publish(DENON_AVR_STATUS_CHANNEL, {
          denonAvrStatusChanged: this.status,
        });
        logger.debug('Published Denon AVR status change to GraphQL subscriptions', {
          status: this.status,
        });
      }
    } catch (error) {
      logger.debug('Failed to publish Denon AVR status change', { error });
    }
  }

  /**
   * Discover and connect to AVR with smart fallback
   */
  private async discoverAndConnect(): Promise<{ ip: string; port: number } | null> {
    logger.info('Starting AVR discovery process');

    // 1. Try database settings first
    const dbSettings = await getCurrentAVRSettings();
    if (dbSettings) {
      logger.info('Testing stored AVR settings from database', {
        ip: dbSettings.ip,
        port: dbSettings.port,
      });

      const validation = await validateAVRDevice(dbSettings.ip, dbSettings.port);
      if (validation.isValid) {
        logger.info('Stored AVR settings are working', {
          ip: dbSettings.ip,
          port: dbSettings.port,
        });
        await addDiscoveryHistory(dbSettings.ip, dbSettings.port, {
          ip: dbSettings.ip,
          method: 'stored',
          success: true,
          responseTime: validation.responseTime,
        });
        return { ip: dbSettings.ip, port: dbSettings.port };
      } else {
        logger.warn('Stored AVR settings failed validation', {
          ip: dbSettings.ip,
          port: dbSettings.port,
          error: validation.error,
        });
        await recordFailedConnection(
          dbSettings.ip,
          dbSettings.port,
          validation.error || 'Validation failed'
        );
      }
    }

    // 2. Try environment settings if different from database
    const envIp = process.env.DENON_AVR_IP;
    const envPort = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : 23;

    if (envIp && (!dbSettings || envIp !== dbSettings.ip || envPort !== dbSettings.port)) {
      logger.info('Testing environment AVR settings', { ip: envIp, port: envPort });

      const validation = await validateAVRDevice(envIp, envPort);
      if (validation.isValid) {
        logger.info('Environment AVR settings are working', { ip: envIp, port: envPort });

        // Update database with working settings
        await upsertAVRSettings(envIp, envPort, { deviceName: 'Denon AVR (from env)' });
        await addDiscoveryHistory(envIp, envPort, {
          ip: envIp,
          method: 'manual',
          success: true,
          responseTime: validation.responseTime,
        });

        return { ip: envIp, port: envPort };
      } else {
        logger.warn('Environment AVR settings failed validation', {
          ip: envIp,
          port: envPort,
          error: validation.error,
        });
      }
    }

    // 3. Network discovery as last resort
    if (!this.shouldSkipDiscovery()) {
      logger.info('Performing network discovery for AVR devices');
      this.discoveryInProgress = true;

      try {
        const candidates = await scanForAVRDevices();
        if (candidates.length > 0) {
          logger.info('Found AVR candidates, validating...', { count: candidates.length });

          const validResults = await validateMultipleAVRCandidates(candidates);
          if (validResults.length > 0) {
            const bestResult = validResults[0]; // Already sorted by response time
            logger.info('Found working AVR via network discovery', {
              ip: bestResult.ip,
              port: bestResult.port,
              responseTime: bestResult.responseTime,
            });

            // Find matching candidate for additional info
            const candidate = candidates.find(c => c.ip === bestResult.ip);

            // Update database with discovered settings
            await upsertAVRSettings(bestResult.ip, bestResult.port, {
              deviceName: candidate?.hostname || 'Denon AVR (discovered)',
              macAddress: candidate?.macAddress,
            });

            await addDiscoveryHistory(bestResult.ip, bestResult.port, {
              ip: bestResult.ip,
              method: 'scan',
              success: true,
              responseTime: bestResult.responseTime,
            });

            return { ip: bestResult.ip, port: bestResult.port };
          }
        }

        logger.warn('Network discovery completed but no valid AVR devices found');
      } catch (error) {
        logger.error('Network discovery failed', { error });
      } finally {
        this.discoveryInProgress = false;
        this.lastDiscoveryTime = Date.now();
      }
    }

    logger.error('AVR discovery failed - no working device found');
    return null;
  }

  /**
   * Check if discovery should be skipped based on timing
   */
  private shouldSkipDiscovery(): boolean {
    const timeSinceLastDiscovery = Date.now() - this.lastDiscoveryTime;
    return this.discoveryInProgress || timeSinceLastDiscovery < this.minDiscoveryInterval;
  }

  /**
   * Initialize Telnet API with current connection settings
   */
  private async initializeWithConnection(): Promise<boolean> {
    try {
      this.denonApi = new DenonTelnetAPI({
        ip: this.ip,
        port: this.port,
        deviceName: 'SmartHome Controller',
        connectionTimeout: 5000,
        commandTimeout: 3000,
      });

      logger.info('Denon AVR Telnet API initialized', { ip: this.ip, port: this.port });

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

      logger.info('Denon AVR connection initialized successfully with real-time monitoring', {
        ip: this.ip,
        port: this.port,
        status: this.status,
      });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Denon AVR connection', { error });
      await recordFailedConnection(
        this.ip,
        this.port,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Initialize the AVR connection with discovery and start real-time monitoring
   */
  async init(): Promise<boolean> {
    if (this.simulationMode) {
      logger.info('Denon AVR service initialized in simulation mode');
      return true;
    }

    // Initialize database settings from environment if needed
    await initializeAVRSettingsFromEnv();

    // Discover and connect to AVR
    const connection = await this.discoverAndConnect();
    if (!connection) {
      logger.error('Failed to discover or connect to any AVR device');
      this.simulationMode = true;
      this.isConnected = false;
      return false;
    }

    // Update connection details
    this.ip = connection.ip;
    this.port = connection.port;

    // Initialize with discovered connection
    const success = await this.initializeWithConnection();
    if (!success) {
      this.simulationMode = true;
      this.isConnected = false;
      return false;
    }

    return true;
  }

  /**
   * Force rediscovery of AVR devices (for manual troubleshooting)
   */
  async forceRediscovery(): Promise<boolean> {
    if (this.simulationMode) {
      logger.warn('Cannot perform rediscovery in simulation mode');
      return false;
    }

    logger.info('Force rediscovery requested');
    this.lastDiscoveryTime = 0; // Reset discovery timer

    // Stop current monitoring
    if (this.denonApi) {
      this.denonApi.stopMonitoring();
    }

    const connection = await this.discoverAndConnect();
    if (!connection) {
      this.isConnected = false;
      return false;
    }

    this.ip = connection.ip;
    this.port = connection.port;

    return await this.initializeWithConnection();
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
      this.status.isPoweredOn = isPoweredOn;

      if (!silent) {
        logger.debug('Power state refreshed', { isPoweredOn });
      }

      if (isPoweredOn) {
        // Only get other status if powered on
        const [volume, isMuted, input, soundMode] = await Promise.all([
          this.denonApi.getVolume(),
          this.denonApi.getMuteState(),
          this.denonApi.getCurrentInput(),
          this.denonApi.getSoundMode(),
        ]);

        this.status.volume = volume;
        this.status.isMuted = isMuted;
        this.status.input = input;
        this.status.soundMode = soundMode;

        if (!silent) {
          logger.debug('AVR status refreshed', { status: this.status });
        }
      } else {
        // If powered off, reset other values
        this.status.volume = 0;
        this.status.isMuted = false;
        this.status.input = '';
        this.status.soundMode = '';
      }

      // Publish the updated status
      this.publishStatusChange();
    } catch (error) {
      if (!silent) {
        logger.error('Failed to refresh AVR status', { error });
      }

      // Connection might be lost, handle it
      if (!this.isConnected) {
        this.handleConnectionLoss();
      }
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
   * Send a command to the AVR with enhanced error handling
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
            if (this.httpApi) {
              logger.info('Falling back to HTTP API for POWER_ON');
              await this.httpApi.powerOn();
            } else {
              logger.warn('No HTTP API available for fallback POWER_ON');
            }
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
          break;

        case 'VOLUME_DOWN':
          if (!this.status.isPoweredOn) return false;
          await this.denonApi.volumeDown();
          break;

        case 'SET_VOLUME':
          if (!this.status.isPoweredOn || !value) return false;
          const volumeLevel = parseFloat(value);
          await this.denonApi.setVolume(volumeLevel);
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

      this.publishStatusChange();
      logger.debug('Denon AVR command sent successfully', { command, value });
      return true;
    } catch (error) {
      logger.error('Failed to send Denon AVR command', { command, value, error });

      // Check if this is a connection issue
      if (
        error instanceof Error &&
        (error.message.includes('ECONNREFUSED') ||
          error.message.includes('EHOSTUNREACH') ||
          error.message.includes('timeout'))
      ) {
        logger.warn('Connection issue detected, will attempt rediscovery');
        this.isConnected = false;
        this.handleConnectionLoss();
      }

      return false;
    }
  }

  /**
   * Update local state for simulation mode
   */
  private updateLocalState(command: string, value?: string): void {
    switch (command) {
      case 'POWER_ON':
        this.status.isPoweredOn = true;
        break;
      case 'POWER_OFF':
        this.status.isPoweredOn = false;
        this.status.volume = 0;
        this.status.isMuted = false;
        this.status.input = '';
        this.status.soundMode = '';
        break;
      case 'VOLUME_UP':
        if (this.status.isPoweredOn) {
          this.status.volume = Math.min(99, this.status.volume + 1);
        }
        break;
      case 'VOLUME_DOWN':
        if (this.status.isPoweredOn) {
          this.status.volume = Math.max(0, this.status.volume - 1);
        }
        break;
      case 'SET_VOLUME':
        if (this.status.isPoweredOn && value) {
          this.status.volume = Math.max(0, Math.min(99, parseFloat(value)));
        }
        break;
      case 'MUTE_TOGGLE':
        if (this.status.isPoweredOn) {
          this.status.isMuted = !this.status.isMuted;
        }
        break;
      case 'MUTE_ON':
        if (this.status.isPoweredOn) {
          this.status.isMuted = true;
        }
        break;
      case 'MUTE_OFF':
        if (this.status.isPoweredOn) {
          this.status.isMuted = false;
        }
        break;
      case 'INPUT_CHANGE':
        if (this.status.isPoweredOn && value) {
          this.status.input = value;
        }
        break;
      case 'SOUND_MODE':
        if (this.status.isPoweredOn && value) {
          this.status.soundMode = value;
        }
        break;
    }

    this.publishStatusChange();
  }

  /**
   * Check if connected to AVR
   */
  isConnectedToAVR(): boolean {
    return this.isConnected && !this.simulationMode;
  }

  /**
   * Check if AVR is reachable
   */
  async isReachable(): Promise<boolean> {
    if (this.simulationMode) {
      return true; // Always reachable in simulation mode
    }

    try {
      const validation = await validateAVRDevice(this.ip, this.port, 3000);
      return validation.isValid;
    } catch (error) {
      logger.debug('AVR reachability check failed', { error });
      return false;
    }
  }

  /**
   * Get current connection info including discovery details
   */
  async getConnectionInfo() {
    try {
      const settings = await getCurrentAVRSettings();

      // Extract latest discovery info from history
      let discoveryMethod = null;
      let responseTime = null;

      if (settings?.discoveryHistory && Array.isArray(settings.discoveryHistory)) {
        const latestEntry = settings.discoveryHistory[settings.discoveryHistory.length - 1];
        if (latestEntry) {
          discoveryMethod = latestEntry.method || null;
          responseTime = latestEntry.responseTime || null;
        }
      }

      return {
        ip: this.ip,
        port: this.port,
        connected: this.isConnected,
        simulation: this.simulationMode,
        lastDiscovery: settings?.lastDiscoveryAt?.toISOString() || null,
        discoveryMethod,
        responseTime,
      };
    } catch (error) {
      logger.warn('Failed to get AVR connection info', { error });
      return {
        ip: this.ip,
        port: this.port,
        connected: this.isConnected,
        simulation: this.simulationMode,
        lastDiscovery: null,
        discoveryMethod: null,
        responseTime: null,
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.denonApi) {
      this.denonApi.stopMonitoring();
      this.denonApi.removeAllListeners();
    }
  }
}

// Export a singleton instance
export const denonAvrService = new DenonAVRService();
