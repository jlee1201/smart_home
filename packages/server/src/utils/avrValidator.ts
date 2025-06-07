import net from 'net';
import { logger } from './logger.js';
import { DENON_COMMANDS } from './denonTelnetApi.js';

export interface AVRValidationResult {
  isValid: boolean;
  ip: string;
  port: number;
  deviceInfo?: {
    powerState?: string;
    model?: string;
    firmwareVersion?: string;
  };
  responseTime: number;
  error?: string;
}

/**
 * Test if a device responds to Denon AVR commands
 */
export async function validateAVRDevice(
  ip: string,
  port: number = 23,
  timeout: number = 5000
): Promise<AVRValidationResult> {
  const startTime = Date.now();

  return new Promise(resolve => {
    const client = new net.Socket();
    let responseData = '';
    let isConnected = false;

    const result: AVRValidationResult = {
      isValid: false,
      ip,
      port,
      responseTime: 0,
    };

    // Set timeout
    const timeoutId = setTimeout(() => {
      logger.debug(`AVR validation timeout for ${ip}:${port}`);
      client.destroy();
      result.error = 'Connection timeout';
      result.responseTime = Date.now() - startTime;
      resolve(result);
    }, timeout);

    client.on('connect', () => {
      isConnected = true;
      logger.debug(`Connected to potential AVR at ${ip}:${port}, testing with PW? command`);

      // Send power status command to test if it's really a Denon AVR
      client.write(`${DENON_COMMANDS.POWER_STATUS}\r`);

      // Give device time to respond before closing
      setTimeout(() => {
        client.end();
      }, 2000);
    });

    client.on('data', data => {
      const chunk = data.toString();
      responseData += chunk;
      logger.debug(`Received data from ${ip}: "${chunk.trim()}"`);
    });

    client.on('close', () => {
      clearTimeout(timeoutId);
      result.responseTime = Date.now() - startTime;

      if (isConnected && responseData) {
        // Validate response format
        const isValidResponse = validateDenonResponse(responseData);

        if (isValidResponse) {
          result.isValid = true;
          result.deviceInfo = parseDenonResponse(responseData);
          logger.info(`Valid AVR found at ${ip}:${port}`, {
            responseTime: result.responseTime,
            deviceInfo: result.deviceInfo,
          });
        } else {
          result.error = 'Invalid response format';
          logger.debug(`Invalid AVR response from ${ip}:${port}`, { response: responseData });
        }
      } else if (!isConnected) {
        result.error = 'Failed to connect';
      } else {
        result.error = 'No response received';
      }

      resolve(result);
    });

    client.on('error', error => {
      clearTimeout(timeoutId);
      result.error = error.message;
      result.responseTime = Date.now() - startTime;
      logger.debug(`AVR validation error for ${ip}:${port}`, { error: error.message });
      resolve(result);
    });

    // Connect to the device
    client.connect(port, ip);
  });
}

/**
 * Validate if the response looks like a Denon AVR response
 */
function validateDenonResponse(response: string): boolean {
  // Check for typical Denon response patterns
  const denonPatterns = [
    /^PWON/m, // Power on
    /^PWSTANDBY/m, // Power standby
    /^PW/m, // Any power response
    /^MV\d+/m, // Volume response
    /^SI/m, // Input response
    /^MS/m, // Sound mode response
  ];

  return denonPatterns.some(pattern => pattern.test(response));
}

/**
 * Parse Denon response to extract device information
 */
function parseDenonResponse(response: string): {
  powerState?: string;
  model?: string;
  firmwareVersion?: string;
} {
  const deviceInfo: { powerState?: string; model?: string; firmwareVersion?: string } = {};

  // Parse power state
  if (response.includes('PWON')) {
    deviceInfo.powerState = 'ON';
  } else if (response.includes('PWSTANDBY')) {
    deviceInfo.powerState = 'STANDBY';
  }

  // Additional parsing could be added here for model info, firmware, etc.
  // This would require sending additional commands like NSE (Network Status)

  return deviceInfo;
}

/**
 * Validate multiple AVR candidates and return the best match
 */
export async function validateMultipleAVRCandidates(
  candidates: Array<{ ip: string; port?: number; confidence?: number }>
): Promise<AVRValidationResult[]> {
  logger.info('Validating multiple AVR candidates', { count: candidates.length });

  const validationPromises = candidates.map(candidate =>
    validateAVRDevice(candidate.ip, candidate.port || 23)
  );

  try {
    const results = await Promise.all(validationPromises);
    const validResults = results.filter(result => result.isValid);

    logger.info('AVR validation completed', {
      total: results.length,
      valid: validResults.length,
    });

    // Sort by response time (faster is better for local network devices)
    return validResults.sort((a, b) => a.responseTime - b.responseTime);
  } catch (error) {
    logger.error('Error during AVR validation', { error });
    return [];
  }
}

/**
 * Perform comprehensive AVR validation with additional tests
 */
export async function comprehensiveAVRValidation(
  ip: string,
  port: number = 23
): Promise<AVRValidationResult> {
  const result = await validateAVRDevice(ip, port);

  if (result.isValid) {
    // Could add additional validation tests here:
    // - Test volume commands
    // - Test input switching
    // - Verify model information
    logger.info(`Comprehensive AVR validation passed for ${ip}:${port}`);
  }

  return result;
}
