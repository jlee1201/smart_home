import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export interface NetworkDevice {
  ip: string;
  hostname?: string;
  macAddress?: string;
  isReachable: boolean;
}

export interface AVRCandidate extends NetworkDevice {
  confidence: number; // 0-1 score of how likely this is an AVR
  reason: string;
}

export interface TVCandidate extends NetworkDevice {
  confidence: number; // 0-1 score of how likely this is a TV
  reason: string;
  brand?: string; // Detected brand (vizio, etc.)
}

/**
 * Parse ARP table to get network devices
 */
export async function getNetworkDevices(): Promise<NetworkDevice[]> {
  try {
    const { stdout } = await execAsync('arp -a');
    const devices: NetworkDevice[] = [];

    const lines = stdout.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse lines like: "avr (192.168.50.99) at 0:5:cd:7d:d8:a6 on en0 ifscope [ethernet]"
      const match = line.match(/^(.+?)\s*\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([a-fA-F0-9:]+)/);
      if (match) {
        const [, hostname, ip, macAddress] = match;
        devices.push({
          ip,
          hostname: hostname.trim(),
          macAddress,
          isReachable: !line.includes('(incomplete)'),
        });
      }
    }

    logger.debug('Discovered network devices from ARP table', { count: devices.length });
    return devices;
  } catch (error) {
    logger.error('Failed to get network devices from ARP table', { error });
    return [];
  }
}

/**
 * Test basic network connectivity to an IP
 */
export async function pingDevice(ip: string, timeout: number = 3000): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`ping -c 1 -W ${timeout} ${ip}`);
    return stdout.includes('1 packets received');
  } catch (error) {
    return false;
  }
}

/**
 * Get the current network subnet based on local IP
 */
export async function getCurrentSubnet(): Promise<string> {
  try {
    const { stdout } = await execAsync("ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1");
    const match = stdout.match(/inet (\d+\.\d+\.\d+)\./);
    if (match) {
      return `${match[1]}.0/24`;
    }
  } catch (error) {
    logger.warn('Failed to determine current subnet', { error });
  }

  // Default fallback - assume common home network
  return '192.168.50.0/24';
}

/**
 * Find potential AVR candidates based on hostname patterns and network behavior
 */
export function identifyAVRCandidates(devices: NetworkDevice[]): AVRCandidate[] {
  const candidates: AVRCandidate[] = [];

  for (const device of devices) {
    if (!device.isReachable) continue;

    let confidence = 0;
    const reasons: string[] = [];

    // Check hostname patterns
    if (device.hostname) {
      const hostname = device.hostname.toLowerCase();

      if (hostname.includes('avr')) {
        confidence += 0.8;
        reasons.push('hostname contains "avr"');
      } else if (hostname.includes('denon')) {
        confidence += 0.9;
        reasons.push('hostname contains "denon"');
      } else if (hostname.includes('marantz')) {
        confidence += 0.7;
        reasons.push('hostname contains "marantz"');
      } else if (/^[a-zA-Z]{2,6}\d{4,}/.test(hostname)) {
        // Pattern like "avr4500" or similar model numbers
        confidence += 0.3;
        reasons.push('hostname matches model pattern');
      }
    }

    // Check MAC address patterns (Denon/Marantz OUI prefixes)
    if (device.macAddress) {
      const macPrefix = device.macAddress.toLowerCase().replace(/[:-]/g, '').substring(0, 6);

      // Common Denon/Marantz MAC prefixes (these are examples - would need actual OUI data)
      const avrMacPrefixes = [
        '0005cd', // Denon
        '001122', // Common network equipment
        // Add more known AVR MAC prefixes here
      ];

      if (avrMacPrefixes.includes(macPrefix)) {
        confidence += 0.4;
        reasons.push('MAC address matches known AVR vendor');
      }
    }

    // Bonus for being in typical AVR IP ranges
    const ipParts = device.ip.split('.');
    const lastOctet = parseInt(ipParts[3]);
    if (lastOctet > 90 && lastOctet < 110) {
      confidence += 0.1;
      reasons.push('IP in typical AVR range');
    }

    if (confidence > 0.2) {
      candidates.push({
        ...device,
        confidence,
        reason: reasons.join(', '),
      });
    }
  }

  // Sort by confidence score
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find potential TV candidates based on hostname patterns and network behavior
 */
export function identifyTVCandidates(devices: NetworkDevice[]): TVCandidate[] {
  const candidates: TVCandidate[] = [];

  for (const device of devices) {
    if (!device.isReachable) continue;

    let confidence = 0;
    let brand: string | undefined;
    const reasons: string[] = [];

    // Check hostname patterns
    if (device.hostname) {
      const hostname = device.hostname.toLowerCase();

      if (hostname.includes('vizio')) {
        confidence += 0.9;
        brand = 'vizio';
        reasons.push('hostname contains "vizio"');
      } else if (hostname.includes('smartcast')) {
        confidence += 0.8;
        brand = 'vizio';
        reasons.push('hostname contains "smartcast"');
      } else if (hostname.includes('tv')) {
        confidence += 0.6;
        reasons.push('hostname contains "tv"');
      } else if (
        hostname.includes('samsung') ||
        hostname.includes('lg') ||
        hostname.includes('sony')
      ) {
        confidence += 0.7;
        brand = hostname.includes('samsung') ? 'samsung' : hostname.includes('lg') ? 'lg' : 'sony';
        reasons.push('hostname matches TV brand');
      } else if (/^[a-zA-Z]{2,6}[\d\w]*tv/i.test(hostname)) {
        // Pattern like "viziotv" or similar
        confidence += 0.5;
        reasons.push('hostname matches TV pattern');
      }
    }

    // Check MAC address patterns for TV vendors
    if (device.macAddress) {
      const macPrefix = device.macAddress.toLowerCase().replace(/[:-]/g, '').substring(0, 6);

      // Common TV manufacturer MAC prefixes
      const tvMacPrefixes = [
        '2c641f', // Vizio
        '58fd2b', // Vizio
        'f8e903', // Vizio
        // Add more known TV MAC prefixes here as needed
      ];

      if (tvMacPrefixes.includes(macPrefix)) {
        confidence += 0.5;
        if (macPrefix === '2c641f' || macPrefix === '58fd2b' || macPrefix === 'f8e903') {
          brand = 'vizio';
        }
        reasons.push('MAC address matches known TV vendor');
      }
    }

    // Bonus for being in typical TV IP ranges (often lower than other devices)
    const ipParts = device.ip.split('.');
    const lastOctet = parseInt(ipParts[3]);
    if (lastOctet > 100 && lastOctet < 130) {
      confidence += 0.1;
      reasons.push('IP in typical TV range');
    }

    if (confidence > 0.3) {
      candidates.push({
        ...device,
        confidence,
        reason: reasons.join(', '),
        brand,
      });
    }
  }

  // Sort by confidence score
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Perform a comprehensive network scan for AVR devices
 */
export async function scanForAVRDevices(): Promise<AVRCandidate[]> {
  try {
    logger.info('Starting network scan for AVR devices');

    const devices = await getNetworkDevices();
    const candidates = identifyAVRCandidates(devices);

    logger.info('Network scan completed', {
      totalDevices: devices.length,
      candidates: candidates.length,
    });

    if (candidates.length > 0) {
      logger.debug('AVR candidates found', {
        candidates: candidates.map(c => ({
          ip: c.ip,
          hostname: c.hostname,
          confidence: c.confidence,
          reason: c.reason,
        })),
      });
    }

    return candidates;
  } catch (error) {
    logger.error('Network scan failed', { error });
    return [];
  }
}

/**
 * Perform a comprehensive network scan for TV devices
 */
export async function scanForTVDevices(): Promise<TVCandidate[]> {
  try {
    logger.info('Starting network scan for TV devices');

    const devices = await getNetworkDevices();
    const candidates = identifyTVCandidates(devices);

    logger.info('TV network scan completed', {
      totalDevices: devices.length,
      candidates: candidates.length,
    });

    if (candidates.length > 0) {
      logger.debug('TV candidates found', {
        candidates: candidates.map(c => ({
          ip: c.ip,
          hostname: c.hostname,
          confidence: c.confidence,
          reason: c.reason,
          brand: c.brand,
        })),
      });
    }

    return candidates;
  } catch (error) {
    logger.error('TV network scan failed', { error });
    return [];
  }
}
