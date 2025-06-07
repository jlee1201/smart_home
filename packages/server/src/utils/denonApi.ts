import axios from 'axios';
import { logger } from './logger.js';

// Type definitions for Denon AVR API
export type DenonAVRConfig = {
  ip: string;
  port?: number;
  deviceName?: string;
};

// Common Denon AVR commands
export const DENON_COMMANDS = {
  // Power commands
  POWER_ON: 'PWON',
  POWER_OFF: 'PWSTANDBY',

  // Volume commands
  VOLUME_UP: 'MVUP',
  VOLUME_DOWN: 'MVDOWN',
  MUTE_ON: 'MUON',
  MUTE_OFF: 'MUOFF',

  // Input selection commands
  INPUT_CBL_SAT: 'SICBL/SAT',
  INPUT_DVD: 'SIDVD',
  INPUT_BD: 'SIBD',
  INPUT_GAME: 'SIGAME',
  INPUT_AUX1: 'SIAUX1',
  INPUT_MPLAY: 'SIMPLAY',
  INPUT_TV: 'SITV',
  INPUT_TUNER: 'SITUNER',
  INPUT_PHONO: 'SIPHONO',
  INPUT_CD: 'SICD',
  INPUT_BLUETOOTH: 'SIBT',
  INPUT_NETWORK: 'SINET',

  // Sound mode commands
  SOUND_MOVIE: 'MSMOVIE',
  SOUND_MUSIC: 'MSMUSIC',
  SOUND_GAME: 'MSGAME',
  SOUND_DIRECT: 'MSDIRECT',
  SOUND_STEREO: 'MSSTEREO',
  SOUND_AUTO: 'MSAUTO',

  // Surround mode commands
  SURROUND_DOLBY: 'MSDOLBY',
  SURROUND_DTS: 'MSDTS',
  SURROUND_MULTI: 'MSMULTI',

  // Navigation commands
  MENU: 'MNMEN',
  UP: 'MNCUP',
  DOWN: 'MNCDN',
  LEFT: 'MNCLT',
  RIGHT: 'MNCRT',
  SELECT: 'MNENT',
  RETURN: 'MNRTN',

  // Playback controls
  PLAY: 'NS9A',
  PAUSE: 'NS9B',
  STOP: 'NS9C',
  PREVIOUS: 'NS9E',
  NEXT: 'NS9D',
};

export class DenonAPI {
  private ip: string;
  private port: number;

  constructor(config: DenonAVRConfig) {
    this.ip = config.ip;
    this.port = config.port || 80; // Default HTTP port for Denon AVR
  }

  private getBaseUrl(): string {
    return `http://${this.ip}:${this.port}`;
  }

  private async sendRequest(command: string): Promise<string> {
    try {
      const url = `${this.getBaseUrl()}/goform/formiPhoneAppDirect.xml?${command}`;

      logger.info(`Sending command to Denon AVR: ${command}`);

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      logger.error('Error communicating with Denon AVR', { error });
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Denon AVR API error: ${error.response.status} ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error(
            `Denon AVR connection error: No response received (AVR might be off or unreachable)`
          );
        }
      }
      throw new Error(`Denon AVR API error: ${error}`);
    }
  }

  /**
   * Send a raw command to the AVR
   * Public method that can be used for direct command access
   */
  async sendCommand(command: string): Promise<string> {
    return this.sendRequest(command);
  }

  /**
   * Get current power state
   */
  async getPowerState(): Promise<boolean> {
    try {
      const response = await this.sendRequest('PW?');
      return response.includes('PWON');
    } catch (error) {
      logger.error('Error getting Denon AVR power state', { error });
      return false;
    }
  }

  /**
   * Turn power on
   */
  async powerOn(): Promise<void> {
    await this.sendRequest(DENON_COMMANDS.POWER_ON);
  }

  /**
   * Turn power off (standby)
   */
  async powerOff(): Promise<void> {
    await this.sendRequest(DENON_COMMANDS.POWER_OFF);
  }

  /**
   * Get current volume level
   */
  async getVolume(): Promise<number> {
    try {
      const response = await this.sendRequest('MV?');
      // Extract volume from response (format like "MV50")
      const volumeMatch = response.match(/MV(\d+)/);
      if (volumeMatch && volumeMatch[1]) {
        return parseInt(volumeMatch[1], 10) / 10; // Convert to 0-100 scale
      }
      return 0;
    } catch (error) {
      logger.error('Error getting Denon AVR volume', { error });
      return 0;
    }
  }

  /**
   * Set volume level (0-100)
   */
  async setVolume(level: number): Promise<void> {
    const volume = Math.max(0, Math.min(100, level));
    // Convert 0-100 to Denon format (0-98)
    const denonVolume = Math.round((volume / 100) * 98);

    if (denonVolume < 10) {
      await this.sendRequest(`MV0${denonVolume}`);
    } else {
      await this.sendRequest(`MV${denonVolume}`);
    }
  }

  /**
   * Increase volume
   */
  async volumeUp(): Promise<void> {
    await this.sendRequest(DENON_COMMANDS.VOLUME_UP);
  }

  /**
   * Decrease volume
   */
  async volumeDown(): Promise<void> {
    await this.sendRequest(DENON_COMMANDS.VOLUME_DOWN);
  }

  /**
   * Get mute status
   */
  async getMuteState(): Promise<boolean> {
    try {
      const response = await this.sendRequest('MU?');
      return response.includes('MUON');
    } catch (error) {
      logger.error('Error getting Denon AVR mute state', { error });
      return false;
    }
  }

  /**
   * Set mute state
   */
  async setMute(mute: boolean): Promise<void> {
    if (mute) {
      await this.sendRequest(DENON_COMMANDS.MUTE_ON);
    } else {
      await this.sendRequest(DENON_COMMANDS.MUTE_OFF);
    }
  }

  /**
   * Toggle mute
   */
  async toggleMute(): Promise<void> {
    const isMuted = await this.getMuteState();
    await this.setMute(!isMuted);
  }

  /**
   * Get current input source
   */
  async getCurrentInput(): Promise<string> {
    try {
      const response = await this.sendRequest('SI?');
      // Extract input from response (format like "SIBD" for Blu-ray)
      const inputMatch = response.match(/SI(.+)/);
      if (inputMatch && inputMatch[1]) {
        return inputMatch[1];
      }
      return '';
    } catch (error) {
      logger.error('Error getting Denon AVR input', { error });
      return '';
    }
  }

  /**
   * Set input source
   */
  async setInput(input: string): Promise<void> {
    await this.sendRequest(`SI${input}`);
  }

  /**
   * Get current sound mode
   */
  async getSoundMode(): Promise<string> {
    try {
      const response = await this.sendRequest('MS?');
      // Extract sound mode from response (format like "MSSTEREO")
      const modeMatch = response.match(/MS(.+)/);
      if (modeMatch && modeMatch[1]) {
        return modeMatch[1];
      }
      return '';
    } catch (error) {
      logger.error('Error getting Denon AVR sound mode', { error });
      return '';
    }
  }

  /**
   * Set sound mode
   */
  async setSoundMode(mode: string): Promise<void> {
    await this.sendRequest(`MS${mode}`);
  }

  /**
   * Send navigation command
   */
  async navigate(
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT' | 'MENU' | 'RETURN'
  ): Promise<void> {
    const commandMap = {
      UP: DENON_COMMANDS.UP,
      DOWN: DENON_COMMANDS.DOWN,
      LEFT: DENON_COMMANDS.LEFT,
      RIGHT: DENON_COMMANDS.RIGHT,
      SELECT: DENON_COMMANDS.SELECT,
      MENU: DENON_COMMANDS.MENU,
      RETURN: DENON_COMMANDS.RETURN,
    };

    await this.sendRequest(commandMap[direction]);
  }

  /**
   * Send playback control command
   */
  async playbackControl(command: 'PLAY' | 'PAUSE' | 'STOP' | 'PREVIOUS' | 'NEXT'): Promise<void> {
    const commandMap = {
      PLAY: DENON_COMMANDS.PLAY,
      PAUSE: DENON_COMMANDS.PAUSE,
      STOP: DENON_COMMANDS.STOP,
      PREVIOUS: DENON_COMMANDS.PREVIOUS,
      NEXT: DENON_COMMANDS.NEXT,
    };

    await this.sendRequest(commandMap[command]);
  }
}

export function createDenonAPIFromEnv(): DenonAPI | null {
  const ip = process.env.DENON_AVR_IP;
  const port = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : undefined;

  if (!ip) {
    // Return null instead of throwing error to allow auto-discovery
    return null;
  }

  return new DenonAPI({
    ip,
    port,
    deviceName: process.env.DENON_AVR_DEVICE_NAME || 'SmartHome Controller',
  });
}
