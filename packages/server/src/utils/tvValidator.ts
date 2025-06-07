import axios from 'axios';
import { logger } from './logger.js';
import type { TVCandidate } from './networkDiscovery.js';

export interface TVValidationResult {
  ip: string;
  port: number;
  isValid: boolean;
  responseTime?: number;
  deviceInfo?: {
    name?: string;
    model?: string;
    version?: string;
    brand?: string;
  };
  authRequired?: boolean;
  error?: string;
}

/**
 * Test if a device responds to Vizio SmartCast API calls
 */
export async function validateVizioTV(
  ip: string,
  port: number = 7345,
  timeout: number = 5000,
  authToken?: string
): Promise<TVValidationResult> {
  const startTime = Date.now();

  try {
    logger.debug('Validating Vizio TV', { ip, port, hasAuth: !!authToken });

    // Try to get device info first (usually doesn't require auth)
    const baseUrl = `https://${ip}:${port}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['AUTH'] = authToken;
    }

    // Configure axios to ignore SSL certificate issues (common with TVs)
    const axiosConfig = {
      timeout,
      headers,
      httpsAgent: new (await import('https')).Agent({
        rejectUnauthorized: false,
      }),
    };

    let deviceInfo: any = undefined;
    let authRequired = false;

    try {
      // Try to get device information
      const response = await axios.get(
        `${baseUrl}/menu_native/dynamic/tv_settings/devices/name`,
        axiosConfig
      );

      if (response.status === 200 && response.data) {
        deviceInfo = {
          name: response.data.ITEMS?.[0]?.VALUE,
          brand: 'vizio',
        };
        logger.debug('Successfully retrieved Vizio device info', { ip, deviceInfo });
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        authRequired = true;
        logger.debug('Vizio TV requires authentication', { ip });
      } else if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
        return {
          ip,
          port,
          isValid: false,
          error: 'Connection refused - not a Vizio TV or wrong port',
        };
      }
    }

    // Try a basic status endpoint
    try {
      const response = await axios.get(
        `${baseUrl}/menu_native/dynamic/tv_settings/devices`,
        axiosConfig
      );

      if (response.status === 200) {
        const responseTime = Date.now() - startTime;
        return {
          ip,
          port,
          isValid: true,
          responseTime,
          deviceInfo,
          authRequired: authRequired && !authToken,
        };
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        const responseTime = Date.now() - startTime;
        return {
          ip,
          port,
          isValid: true, // It's a valid TV, just needs auth
          responseTime,
          deviceInfo,
          authRequired: true,
        };
      }
    }

    // If we get here, try one more basic endpoint
    try {
      const response = await axios.get(`${baseUrl}/state/device/power_mode`, axiosConfig);

      if (response.status === 200 || (response.status >= 400 && response.status < 500)) {
        const responseTime = Date.now() - startTime;
        return {
          ip,
          port,
          isValid: true,
          responseTime,
          deviceInfo,
          authRequired: authRequired && !authToken,
        };
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        const responseTime = Date.now() - startTime;
        return {
          ip,
          port,
          isValid: true,
          responseTime,
          deviceInfo,
          authRequired: true,
        };
      }
    }

    return {
      ip,
      port,
      isValid: false,
      error: 'No valid Vizio API responses received',
    };
  } catch (error: any) {
    logger.debug('TV validation failed', { ip, port, error: error.message });
    return {
      ip,
      port,
      isValid: false,
      error: error.message,
    };
  }
}

/**
 * Validate multiple TV candidates and return the best matches
 */
export async function validateTVCandidates(
  candidates: TVCandidate[],
  authToken?: string
): Promise<TVValidationResult[]> {
  logger.info('Validating TV candidates', { count: candidates.length });

  const validationPromises = candidates.map(candidate =>
    validateVizioTV(candidate.ip, 7345, 3000, authToken)
  );

  const results = await Promise.all(validationPromises);
  const validTVs = results.filter(result => result.isValid);

  logger.info('TV validation completed', {
    total: results.length,
    valid: validTVs.length,
  });

  if (validTVs.length > 0) {
    logger.debug('Valid TVs found', {
      tvs: validTVs.map(tv => ({
        ip: tv.ip,
        responseTime: tv.responseTime,
        authRequired: tv.authRequired,
        deviceName: tv.deviceInfo?.name,
      })),
    });
  }

  // Sort by response time (fastest first)
  return validTVs.sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999));
}

/**
 * Discover TVs on the network and validate them
 */
export async function discoverAndValidateTVs(authToken?: string): Promise<TVValidationResult[]> {
  const { scanForTVDevices } = await import('./networkDiscovery.js');

  logger.info('Starting TV discovery and validation');

  const candidates = await scanForTVDevices();
  if (candidates.length === 0) {
    logger.info('No TV candidates found during network scan');
    return [];
  }

  const results = await validateTVCandidates(candidates, authToken);

  logger.info('TV discovery completed', {
    candidates: candidates.length,
    validated: results.length,
  });

  return results;
}
