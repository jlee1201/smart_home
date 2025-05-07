import { DenonTelnetAPI } from '../utils/denonTelnetApi.js';

// IP address of the Denon AVR-X4500H from environment or hardcoded
const denonAvrIp = process.env.DENON_AVR_IP || '192.168.50.98';
const denonAvrPort = process.env.DENON_AVR_PORT ? parseInt(process.env.DENON_AVR_PORT, 10) : 23;

// Create the Denon AVR API instance
export const denonTelnetApi = new DenonTelnetAPI({
  ip: denonAvrIp,
  port: denonAvrPort,
  deviceName: 'SmartHome Controller',
  // Adjust timeouts if needed
  connectionTimeout: 5000,
  commandTimeout: 3000
}); 