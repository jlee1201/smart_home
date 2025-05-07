// Verify Denon AVR Connection
// Simple script to test the connection to the Denon AVR and display current status
import { denonTelnetApi } from './packages/server/src/config/denon.js';

async function verifyConnection() {
  console.log('=== Denon AVR Connection Verification ===');
  console.log('Testing connection and getting device status...\n');
  
  try {
    // Test basic connectivity - power status
    console.log('1. Testing power status...');
    const isPowered = await denonTelnetApi.getPowerState();
    console.log(`   Power status: ${isPowered ? 'ON' : 'OFF'}\n`);
    
    if (!isPowered) {
      console.log('Device is powered off. Cannot get further status information.');
      return;
    }
    
    // Get volume level
    console.log('2. Testing volume retrieval...');
    const volume = await denonTelnetApi.getVolume();
    console.log(`   Current volume: ${volume}%\n`);
    
    // Get mute status
    console.log('3. Testing mute status...');
    const isMuted = await denonTelnetApi.getMuteState();
    console.log(`   Mute status: ${isMuted ? 'MUTED' : 'NOT MUTED'}\n`);
    
    // Get current input
    console.log('4. Testing input status...');
    const input = await denonTelnetApi.getCurrentInput();
    console.log(`   Current input: ${input}\n`);
    
    // Get sound mode
    console.log('5. Testing sound mode...');
    const soundMode = await denonTelnetApi.getSoundMode();
    console.log(`   Current sound mode: ${soundMode}\n`);
    
    console.log('=== Connection Test Complete ===');
    console.log('All systems operational!');
    
  } catch (error) {
    console.error('ERROR: Failed to connect to or communicate with Denon AVR');
    console.error(`Error details: ${error.message}`);
    console.error('Please check:');
    console.error('1. Is the device powered on?');
    console.error('2. Is the IP address correct? (Current: 192.168.50.98)');
    console.error('3. Is the network connection stable?');
  }
}

// Run the verification
verifyConnection().catch(console.error); 