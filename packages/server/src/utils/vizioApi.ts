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
  
  constructor(config: VizioTVConfig) {
    this.ip = config.ip;
    this.port = config.port || 7345; // Default Vizio SmartCast port
    this.authToken = config.authToken || null;
    this.deviceId = config.deviceId || crypto.randomUUID();
    this.deviceName = config.deviceName || 'SmartHome Controller';
  }
  
  private getBaseUrl(): string {
    return `https://${this.ip}:${this.port}`;
  }
  
  private async sendRequest(
    endpoint: string, 
    method: string = 'GET', 
    data: any = null, 
    requiresAuth: boolean = true
  ) {
    try {
      const url = `${this.getBaseUrl()}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (requiresAuth && this.authToken) {
        headers['AUTH'] = this.authToken;
      }
      
      logger.info(`Sending ${method} request to ${url}`);
      
      const response = await axios({
        method,
        url,
        headers,
        data,
        // Skip SSL certificate verification for local network devices
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      
      return response.data;
    } catch (error) {
      logger.error('Error communicating with Vizio TV', { error });
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Vizio API error: ${error.response.status} ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error(`Vizio TV connection error: No response received (TV might be off or unreachable)`);
        }
      }
      throw new Error(`Vizio API error: ${error}`);
    }
  }
  
  /**
   * Initiate the pairing process
   * This returns a challenge code that the user needs to enter on their TV
   */
  async initiatePairing(): Promise<string> {
    const data = {
      DEVICE_ID: this.deviceId,
      DEVICE_NAME: this.deviceName,
      CHALLENGE_TYPE: 1, // PIN code
    };
    
    const response = await this.sendRequest('/pairing/start', 'PUT', data, false);
    if (response && response.ITEM && response.ITEM.CHALLENGE_KEY) {
      return response.ITEM.CHALLENGE_KEY;
    }
    
    throw new Error('Failed to initiate pairing with TV');
  }
  
  /**
   * Complete the pairing using the PIN displayed on the TV
   */
  async completePairing(pin: string): Promise<string> {
    const data = {
      DEVICE_ID: this.deviceId,
      CHALLENGE_TYPE: 1,
      RESPONSE_VALUE: pin,
    };
    
    const response = await this.sendRequest('/pairing/pair', 'PUT', data, false);
    if (response && response.ITEM && response.ITEM.AUTH_TOKEN) {
      this.authToken = response.ITEM.AUTH_TOKEN;
      return response.ITEM.AUTH_TOKEN;
    }
    
    throw new Error('Failed to complete pairing with TV');
  }
  
  /**
   * Get current power state
   */
  async getPowerState(): Promise<boolean> {
    const response = await this.sendRequest('/state/device/power_mode');
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE === 1;
    }
    return false;
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
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE as number;
    }
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
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE === 1;
    }
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
    if (response && response.ITEMS && response.ITEMS.length > 0) {
      return response.ITEMS[0].VALUE as string;
    }
    return '';
  }
  
  /**
   * Set input
   */
  async setInput(input: string): Promise<void> {
    const data = {
      REQUEST: "MODIFY",
      ITEMS: [{
        NAME: "CURRENT_INPUT",
        VALUE: input
      }]
    };
    
    await this.sendRequest('/menu_native/dynamic/tv_settings/devices/current_input', 'PUT', data);
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
  async sendKeyPress(key: string): Promise<void> {
    const data: VizioCommandPayload = {
      KEYLIST: [key]
    };
    
    await this.sendRequest('/key_command/', 'PUT', data);
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
    
    await this.sendRequest('/app/launch', 'PUT', data);
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