import { prisma } from './db.js';
import { logger } from './logger.js';

export interface AVRSettings {
  id: number;
  ip: string;
  port: number;
  deviceName?: string | null;
  macAddress?: string | null;
  lastConnectedAt?: Date | null;
  lastDiscoveryAt?: Date | null;
  failedAttempts: number;
  isActive: boolean;
  discoveryHistory?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscoveryHistoryEntry {
  timestamp: string;
  ip: string;
  method: 'stored' | 'scan' | 'manual';
  success: boolean;
  responseTime?: number;
  error?: string;
}

/**
 * Get the current active AVR settings
 */
export async function getCurrentAVRSettings(): Promise<AVRSettings | null> {
  try {
    if (!prisma) {
      logger.error('Prisma client not available');
      return null;
    }

    const settings = await prisma.aVRSettings.findFirst({
      where: { isActive: true },
      orderBy: { lastConnectedAt: 'desc' },
    });

    return settings as AVRSettings | null;
  } catch (error) {
    logger.error('Failed to get current AVR settings', { error });
    return null;
  }
}

/**
 * Create or update AVR settings
 */
export async function upsertAVRSettings(
  ip: string,
  port: number = 23,
  deviceData?: {
    deviceName?: string;
    macAddress?: string;
  }
): Promise<AVRSettings> {
  try {
    if (!prisma) {
      throw new Error('Prisma client not available');
    }

    // First, mark all existing settings as inactive
    await prisma.aVRSettings.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create or update the settings for this IP/port combination
    const settings = await prisma.aVRSettings.upsert({
      where: {
        ip_port: {
          ip,
          port,
        },
      },
      update: {
        isActive: true,
        lastConnectedAt: new Date(),
        failedAttempts: 0,
        deviceName: deviceData?.deviceName,
        macAddress: deviceData?.macAddress,
        updatedAt: new Date(),
      },
      create: {
        ip,
        port,
        deviceName: deviceData?.deviceName,
        macAddress: deviceData?.macAddress,
        lastConnectedAt: new Date(),
        lastDiscoveryAt: new Date(),
        failedAttempts: 0,
        isActive: true,
        discoveryHistory: [],
      },
    });

    logger.info('AVR settings updated', { ip, port, id: settings.id });
    return settings as AVRSettings;
  } catch (error) {
    logger.error('Failed to upsert AVR settings', { error, ip, port });
    throw error;
  }
}

/**
 * Record a failed connection attempt
 */
export async function recordFailedConnection(
  ip: string,
  port: number,
  error: string
): Promise<void> {
  try {
    if (!prisma) {
      logger.error('Prisma client not available');
      return;
    }

    await prisma.aVRSettings.updateMany({
      where: { ip, port, isActive: true },
      data: {
        failedAttempts: {
          increment: 1,
        },
        updatedAt: new Date(),
      },
    });

    logger.debug('Recorded failed AVR connection', { ip, port, error });
  } catch (dbError) {
    logger.error('Failed to record failed connection', { dbError, ip, port });
  }
}

/**
 * Add discovery history entry
 */
export async function addDiscoveryHistory(
  ip: string,
  port: number,
  entry: Omit<DiscoveryHistoryEntry, 'timestamp'>
): Promise<void> {
  try {
    if (!prisma) {
      logger.error('Prisma client not available');
      return;
    }

    const settings = await prisma.aVRSettings.findFirst({
      where: { ip, port },
    });

    if (!settings) {
      logger.warn('Cannot add discovery history - AVR settings not found', { ip, port });
      return;
    }

    const history = Array.isArray(settings.discoveryHistory) ? settings.discoveryHistory : [];

    const newEntry: DiscoveryHistoryEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // Keep only the last 50 entries
    const updatedHistory = [...history, newEntry].slice(-50);

    await prisma.aVRSettings.update({
      where: { id: settings.id },
      data: {
        discoveryHistory: updatedHistory as any,
        lastDiscoveryAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.debug('Added discovery history entry', { ip, port, method: entry.method });
  } catch (error) {
    logger.error('Failed to add discovery history', { error, ip, port });
  }
}

/**
 * Get discovery history for an AVR
 */
export async function getDiscoveryHistory(
  ip: string,
  port: number
): Promise<DiscoveryHistoryEntry[]> {
  try {
    if (!prisma) {
      logger.error('Prisma client not available');
      return [];
    }

    const settings = await prisma.aVRSettings.findFirst({
      where: { ip, port },
    });

    if (!settings || !Array.isArray(settings.discoveryHistory)) {
      return [];
    }

    return settings.discoveryHistory as unknown as DiscoveryHistoryEntry[];
  } catch (error) {
    logger.error('Failed to get discovery history', { error, ip, port });
    return [];
  }
}

/**
 * Clean up old failed AVR settings
 */
export async function cleanupOldAVRSettings(daysOld: number = 30): Promise<void> {
  try {
    if (!prisma) {
      logger.error('Prisma client not available');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.aVRSettings.deleteMany({
      where: {
        isActive: false,
        updatedAt: {
          lt: cutoffDate,
        },
        failedAttempts: {
          gt: 10,
        },
      },
    });

    if (result.count > 0) {
      logger.info('Cleaned up old AVR settings', { count: result.count });
    }
  } catch (error) {
    logger.error('Failed to cleanup old AVR settings', { error });
  }
}

/**
 * Initialize AVR settings from environment if none exist
 */
export async function initializeAVRSettingsFromEnv(): Promise<AVRSettings | null> {
  try {
    const existingSettings = await getCurrentAVRSettings();
    if (existingSettings) {
      return existingSettings;
    }

    // Create initial settings from environment variables
    const envIp = process.env.DENON_AVR_IP;
    const envPort = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : 23;

    if (!envIp) {
      logger.warn('No AVR IP in environment and no database settings found');
      return null;
    }

    logger.info('Initializing AVR settings from environment', { ip: envIp, port: envPort });

    const settings = await upsertAVRSettings(envIp, envPort, {
      deviceName: 'Denon AVR (from env)',
    });

    await addDiscoveryHistory(envIp, envPort, {
      ip: envIp,
      method: 'manual',
      success: false, // Will be updated when connection is tested
    });

    return settings;
  } catch (error) {
    logger.error('Failed to initialize AVR settings from environment', { error });
    return null;
  }
}
