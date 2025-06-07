import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';
import type { TVValidationResult } from './tvValidator.js';

let prisma: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export interface TVConnectionInfo {
  ip: string;
  port: number;
  authToken?: string;
  deviceName?: string;
  macAddress?: string;
}

/**
 * Save or update TV settings in the database
 */
export async function saveTVSettings(
  validationResult: TVValidationResult,
  authToken?: string,
  macAddress?: string
): Promise<void> {
  try {
    const client = getPrismaClient();

    const discoveryEntry = {
      timestamp: new Date().toISOString(),
      ip: validationResult.ip,
      responseTime: validationResult.responseTime,
      deviceInfo: validationResult.deviceInfo,
    };

    await client.tVSettings.upsert({
      where: {
        ip_port: {
          ip: validationResult.ip,
          port: validationResult.port,
        },
      },
      update: {
        authToken,
        deviceName: validationResult.deviceInfo?.name,
        macAddress,
        lastConnectedAt: new Date(),
        lastDiscoveryAt: new Date(),
        failedAttempts: 0,
        isActive: true,
        discoveryHistory: {
          push: discoveryEntry,
        },
      },
      create: {
        ip: validationResult.ip,
        port: validationResult.port,
        authToken,
        deviceName: validationResult.deviceInfo?.name,
        macAddress,
        lastConnectedAt: new Date(),
        lastDiscoveryAt: new Date(),
        failedAttempts: 0,
        isActive: true,
        discoveryHistory: [discoveryEntry],
      },
    });

    logger.info('TV settings saved to database', {
      ip: validationResult.ip,
      port: validationResult.port,
      deviceName: validationResult.deviceInfo?.name,
    });
  } catch (error) {
    logger.error('Failed to save TV settings', {
      ip: validationResult.ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get the most recently connected TV settings
 */
export async function getActiveTVSettings(): Promise<TVConnectionInfo | null> {
  try {
    const client = getPrismaClient();

    const settings = await client.tVSettings.findFirst({
      where: { isActive: true },
      orderBy: { lastConnectedAt: 'desc' },
    });

    if (!settings) {
      logger.debug('No active TV settings found in database');
      return null;
    }

    logger.debug('Retrieved active TV settings from database', {
      ip: settings.ip,
      port: settings.port,
      deviceName: settings.deviceName,
    });

    return {
      ip: settings.ip,
      port: settings.port,
      authToken: settings.authToken || undefined,
      deviceName: settings.deviceName || undefined,
      macAddress: settings.macAddress || undefined,
    };
  } catch (error) {
    logger.error('Failed to get TV settings from database', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Update failed connection attempts
 */
export async function recordTVConnectionFailure(ip: string, port: number): Promise<void> {
  try {
    const client = getPrismaClient();

    await client.tVSettings.updateMany({
      where: { ip, port },
      data: {
        failedAttempts: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    logger.debug('Recorded TV connection failure', { ip, port });
  } catch (error) {
    logger.error('Failed to record TV connection failure', {
      ip,
      port,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Mark successful TV connection
 */
export async function recordTVConnectionSuccess(ip: string, port: number): Promise<void> {
  try {
    const client = getPrismaClient();

    await client.tVSettings.updateMany({
      where: { ip, port },
      data: {
        lastConnectedAt: new Date(),
        failedAttempts: 0,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    logger.debug('Recorded TV connection success', { ip, port });
  } catch (error) {
    logger.error('Failed to record TV connection success', {
      ip,
      port,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get TV settings that haven't been discovered recently
 */
export async function getTVsNeedingRediscovery(
  maxAge: number = 60000 // 1 minute default
): Promise<TVConnectionInfo[]> {
  try {
    const client = getPrismaClient();
    const cutoffTime = new Date(Date.now() - maxAge);

    const settings = await client.tVSettings.findMany({
      where: {
        isActive: true,
        OR: [{ lastDiscoveryAt: null }, { lastDiscoveryAt: { lt: cutoffTime } }],
      },
      orderBy: { lastConnectedAt: 'desc' },
    });

    logger.debug('Found TVs needing rediscovery', {
      count: settings.length,
      cutoffTime,
    });

    return settings.map(s => ({
      ip: s.ip,
      port: s.port,
      authToken: s.authToken || undefined,
      deviceName: s.deviceName || undefined,
      macAddress: s.macAddress || undefined,
    }));
  } catch (error) {
    logger.error('Failed to get TVs needing rediscovery', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Clean up old discovery history to prevent database bloat
 */
export async function cleanupTVDiscoveryHistory(maxEntries: number = 50): Promise<void> {
  try {
    const client = getPrismaClient();

    const settings = await client.tVSettings.findMany({
      select: { id: true, discoveryHistory: true },
    });

    for (const setting of settings) {
      const history = Array.isArray(setting.discoveryHistory) ? setting.discoveryHistory : [];

      if (history.length > maxEntries) {
        const trimmedHistory = history.slice(-maxEntries);

        await client.tVSettings.update({
          where: { id: setting.id },
          data: { discoveryHistory: trimmedHistory },
        });
      }
    }

    logger.debug('Cleaned up TV discovery history', {
      processedSettings: settings.length,
      maxEntries,
    });
  } catch (error) {
    logger.error('Failed to cleanup TV discovery history', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
