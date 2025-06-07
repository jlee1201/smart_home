import { prisma } from '../utils/db.js';
import { logger } from '../utils/logger.js';

export type TVSettingsInput = {
  ip: string;
  authToken?: string | null;
  port?: number;
  deviceId?: string | null;
  deviceName?: string | null;
};

// Initialize in-memory settings from environment variables if available
let inMemorySettings: TVSettingsInput | null = process.env.VIZIO_TV_IP
  ? {
      ip: process.env.VIZIO_TV_IP,
      authToken: process.env.VIZIO_AUTH_TOKEN || null,
      port: process.env.VIZIO_TV_PORT ? parseInt(process.env.VIZIO_TV_PORT) : 7345,
      deviceName: process.env.VIZIO_DEVICE_NAME || undefined,
    }
  : null;

if (inMemorySettings) {
  logger.info('Initialized in-memory TV settings from environment variables');
}

class TVSettingsService {
  /**
   * Get the current TV settings
   */
  async getSettings() {
    try {
      if (!prisma) {
        logger.warn('No database connection, using in-memory settings');
        return inMemorySettings;
      }

      // Get the first settings record or null if none exist
      const settings = await prisma.tVSettings.findFirst();
      return settings;
    } catch (error) {
      logger.error('Failed to get TV settings from database', { error });
      return inMemorySettings;
    }
  }

  /**
   * Create or update TV settings
   */
  async saveSettings(settings: TVSettingsInput) {
    try {
      if (!prisma) {
        logger.warn('No database connection, storing settings in memory only');
        inMemorySettings = settings;
        return { ...settings, id: 0 }; // Fake ID
      }

      const existingSettings = await prisma.tVSettings.findFirst();

      if (existingSettings) {
        // Update existing settings
        const updated = await prisma.tVSettings.update({
          where: { id: existingSettings.id },
          data: {
            ...settings,
            updatedAt: new Date(),
          },
        });

        // Keep in-memory cache in sync
        inMemorySettings = settings;
        return updated;
      } else {
        // Create new settings
        const created = await prisma.tVSettings.create({
          data: settings,
        });

        // Keep in-memory cache in sync
        inMemorySettings = settings;
        return created;
      }
    } catch (error) {
      logger.error('Failed to save TV settings to database', { error });
      // Fallback to memory store
      inMemorySettings = settings;
      return { ...settings, id: 0 }; // Fake ID
    }
  }

  /**
   * Update the auth token
   */
  async saveAuthToken(authToken: string) {
    try {
      if (!prisma) {
        logger.warn('No database connection, storing auth token in memory only');
        if (inMemorySettings) {
          inMemorySettings.authToken = authToken;
          return { ...inMemorySettings, id: 0 }; // Fake ID
        } else {
          throw new Error('No settings exist in memory');
        }
      }

      const existingSettings = await prisma.tVSettings.findFirst();

      if (existingSettings) {
        // Update existing settings with new auth token
        const updated = await prisma.tVSettings.update({
          where: { id: existingSettings.id },
          data: {
            authToken,
            updatedAt: new Date(),
          },
        });

        // Keep in-memory cache in sync
        if (inMemorySettings) {
          inMemorySettings.authToken = authToken;
        } else {
          inMemorySettings = {
            ip: existingSettings.ip,
            authToken,
            port: existingSettings.port,
            deviceId: existingSettings.deviceId || undefined,
            deviceName: existingSettings.deviceName || undefined,
          };
        }

        return updated;
      } else {
        logger.error('Cannot save auth token - no TV settings exist');
        throw new Error('No TV settings found. Please configure TV settings first.');
      }
    } catch (error) {
      logger.error('Failed to save auth token to database', { error });
      // Try to at least keep it in memory
      if (inMemorySettings) {
        inMemorySettings.authToken = authToken;
      }
      throw error;
    }
  }
}

export const tvSettingsService = new TVSettingsService();
