import { DenonTelnetAPI } from './packages/server/src/utils/denonTelnetApi.js';

// Create API instance
const denonApi = new DenonTelnetAPI({
  ip: '192.168.50.98',
  port: 23,
  deviceName: 'Test Client',
  connectionTimeout: 5000,
  commandTimeout: 3000
});

// Test function
async function testDenonApi() {
  console.log('Testing Denon AVR Telnet API...');
  
  try {
    // Test connection and get power state
    console.log('Getting power state...');
    const isPowered = await denonApi.getPowerState();
    console.log(`Power state: ${isPowered ? 'ON' : 'OFF'}`);
    
    // Test getting volume
    console.log('Getting volume...');
    const volume = await denonApi.getVolume();
    console.log(`Volume: ${volume}%`);
    
    // Test getting mute state
    console.log('Getting mute state...');
    const isMuted = await denonApi.getMuteState();
    console.log(`Mute state: ${isMuted ? 'MUTED' : 'NOT MUTED'}`);
    
    // Test getting current input
    console.log('Getting current input...');
    const input = await denonApi.getCurrentInput();
    console.log(`Current input: ${input}`);
    
    // Test getting sound mode
    console.log('Getting sound mode...');
    const soundMode = await denonApi.getSoundMode();
    console.log(`Sound mode: ${soundMode}`);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testDenonApi(); 