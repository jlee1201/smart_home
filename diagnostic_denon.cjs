// Diagnostic script for Denon AVR connection
const net = require('net');

// Configuration
const AVR_IP = '192.168.50.98';
const AVR_PORT = 23;
const TIMEOUT = 5000;

// Command definitions
const COMMANDS = {
  POWER_STATUS: 'PW?',
  VOLUME_STATUS: 'MV?',
  MUTE_STATUS: 'MU?',
  INPUT_STATUS: 'SI?',
  SOUND_MODE: 'MS?'
};

// Helper function to send a command and get full response
async function sendCommand(command) {
  return new Promise((resolve) => {
    console.log(`\nSending command: ${command}`);
    
    const client = new net.Socket();
    let response = '';
    let error = null;
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      console.log(`  Timeout waiting for response to ${command}`);
      client.destroy();
      resolve({ success: false, data: response, error: 'Timeout' });
    }, TIMEOUT);
    
    // Handle connection
    client.on('connect', () => {
      console.log(`  Connected to ${AVR_IP}:${AVR_PORT}`);
      client.write(`${command}\r`);
    });
    
    // Handle data
    client.on('data', (data) => {
      const chunk = data.toString();
      response += chunk;
      console.log(`  Received chunk: "${chunk.trim()}"`);
    });
    
    // Handle errors
    client.on('error', (err) => {
      error = err.message;
      console.error(`  Connection error: ${err.message}`);
      clearTimeout(timeoutId);
      client.destroy();
      resolve({ success: false, data: response, error });
    });
    
    // Handle close
    client.on('close', () => {
      clearTimeout(timeoutId);
      console.log(`  Connection closed`);
      const success = !error && response.length > 0;
      resolve({ success, data: response, error });
    });
    
    // Connect
    client.connect(AVR_PORT, AVR_IP);
  });
}

// Function to test and analyze volume parsing
function analyzeVolumeResponse(response) {
  console.log('\n--- Volume Analysis ---');
  
  if (!response.success || !response.data) {
    console.log('Failed to get volume data');
    return null;
  }
  
  console.log('Raw response:', response.data);
  
  // Split into lines
  const lines = response.data.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
  console.log('Response lines:', lines);
  
  // Try different parsing methods
  console.log('\nTrying parsing methods:');
  
  // Method 1: First line that starts with MV and contains only digits after
  const mvLine = lines.find(line => /^MV\d+$/.test(line));
  if (mvLine) {
    const volumeValue = parseInt(mvLine.replace('MV', ''), 10);
    console.log(`Method 1 (MV line): Found "${mvLine}" -> ${volumeValue}`);
    
    // Check if it's a weird format (3 digits)
    if (volumeValue > 100) {
      const normalized = Math.round(volumeValue / 10);
      console.log(`  Value > 100, interpreting as ${normalized}.${volumeValue % 10}%`);
      console.log(`  Final percentage: ${Math.round((normalized / 99) * 100)}%`);
    } else {
      console.log(`  Final percentage: ${Math.round((volumeValue / 99) * 100)}%`);
    }
  } else {
    console.log('Method 1 (MV line): No match found');
  }
  
  // Method 2: Use regex to find MV followed by digits anywhere
  const volumeMatch = response.data.match(/MV(\d+)/);
  if (volumeMatch && volumeMatch[1]) {
    const volumeValue = parseInt(volumeMatch[1], 10);
    console.log(`Method 2 (regex): Found "${volumeMatch[0]}" -> ${volumeValue}`);
    
    // Check if it's a weird format (3 digits)
    if (volumeValue > 100) {
      const normalized = Math.round(volumeValue / 10);
      console.log(`  Value > 100, interpreting as ${normalized}.${volumeValue % 10}%`);
      console.log(`  Final percentage: ${Math.round((normalized / 99) * 100)}%`);
    } else {
      console.log(`  Final percentage: ${Math.round((volumeValue / 99) * 100)}%`);
    }
  } else {
    console.log('Method 2 (regex): No match found');
  }
  
  return volumeMatch ? parseInt(volumeMatch[1], 10) : null;
}

// Main diagnostic function
async function runDiagnostics() {
  console.log('=== Denon AVR Connection Diagnostics ===\n');
  
  // Basic connection test
  console.log('1. Testing basic connection...');
  let connected = false;
  
  try {
    const client = new net.Socket();
    
    connected = await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('  Connection timed out');
        client.destroy();
        resolve(false);
      }, TIMEOUT);
      
      client.on('connect', () => {
        console.log(`  Successfully connected to ${AVR_IP}:${AVR_PORT}`);
        clearTimeout(timeoutId);
        client.destroy();
        resolve(true);
      });
      
      client.on('error', (error) => {
        console.error(`  Connection error: ${error.message}`);
        clearTimeout(timeoutId);
        client.destroy();
        resolve(false);
      });
      
      console.log(`  Attempting to connect to ${AVR_IP}:${AVR_PORT}...`);
      client.connect(AVR_PORT, AVR_IP);
    });
  } catch (error) {
    console.error(`  Error in connection test: ${error.message}`);
  }
  
  if (!connected) {
    console.error('\nFailed to connect to the AVR. Please check:');
    console.error('1. Is the IP address correct?');
    console.error('2. Is the AVR powered on?');
    console.error('3. Is there a network issue?');
    return;
  }
  
  // Test power status
  console.log('\n2. Testing power status...');
  const powerResponse = await sendCommand(COMMANDS.POWER_STATUS);
  
  if (powerResponse.success) {
    const isPoweredOn = powerResponse.data.includes('PWON');
    console.log(`  Power status: ${isPoweredOn ? 'ON' : 'OFF'}`);
    
    // If not powered on, we can't continue with certain tests
    if (!isPoweredOn) {
      console.log('\nDevice appears to be powered off. Cannot proceed with volume tests.');
      return;
    }
  } else {
    console.log('  Failed to get power status');
  }
  
  // Test volume
  console.log('\n3. Testing volume status...');
  const volumeResponse = await sendCommand(COMMANDS.VOLUME_STATUS);
  analyzeVolumeResponse(volumeResponse);
  
  // Test mute
  console.log('\n4. Testing mute status...');
  const muteResponse = await sendCommand(COMMANDS.MUTE_STATUS);
  
  if (muteResponse.success) {
    const isMuted = muteResponse.data.includes('MUON');
    console.log(`  Mute status: ${isMuted ? 'MUTED' : 'NOT MUTED'}`);
  } else {
    console.log('  Failed to get mute status');
  }
  
  // Test input
  console.log('\n5. Testing input status...');
  const inputResponse = await sendCommand(COMMANDS.INPUT_STATUS);
  
  if (inputResponse.success) {
    const inputMatch = inputResponse.data.match(/SI(.+?)(\s|$|\r|\n)/);
    if (inputMatch && inputMatch[1]) {
      console.log(`  Current input: ${inputMatch[1]}`);
    } else {
      console.log('  Could not parse input from response');
    }
  } else {
    console.log('  Failed to get input status');
  }
  
  // Test sound mode
  console.log('\n6. Testing sound mode...');
  const soundModeResponse = await sendCommand(COMMANDS.SOUND_MODE);
  
  if (soundModeResponse.success) {
    const modeMatch = soundModeResponse.data.match(/MS(.+?)(\s|$|\r|\n)/);
    if (modeMatch && modeMatch[1]) {
      console.log(`  Current sound mode: ${modeMatch[1]}`);
    } else {
      console.log('  Could not parse sound mode from response');
    }
  } else {
    console.log('  Failed to get sound mode');
  }
  
  // Summary
  console.log('\n=== DIAGNOSIS SUMMARY ===');
  console.log('1. Connection: ' + (connected ? 'SUCCESS' : 'FAILED'));
  console.log('2. Power Status: ' + (powerResponse.success ? (powerResponse.data.includes('PWON') ? 'ON' : 'OFF') : 'FAILED'));
  
  // Volume analysis
  if (volumeResponse.success) {
    const volumeMatch = volumeResponse.data.match(/MV(\d+)/);
    if (volumeMatch && volumeMatch[1]) {
      const volumeValue = parseInt(volumeMatch[1], 10);
      // Normalize if it's in the format like 515 (51.5%)
      const normalizedVolume = volumeValue > 100 ? Math.round(volumeValue / 10) : volumeValue;
      const volumePercent = Math.round((normalizedVolume / 99) * 100);
      console.log(`3. Volume: ${volumePercent}% (raw value: ${volumeValue})`);
    } else {
      console.log('3. Volume: PARSING FAILED');
    }
  } else {
    console.log('3. Volume: QUERY FAILED');
  }
  
  console.log('4. Mute: ' + (muteResponse.success ? (muteResponse.data.includes('MUON') ? 'ON' : 'OFF') : 'FAILED'));
  
  if (inputResponse.success) {
    const inputMatch = inputResponse.data.match(/SI(.+?)(\s|$|\r|\n)/);
    console.log('5. Input: ' + (inputMatch && inputMatch[1] ? inputMatch[1] : 'PARSING FAILED'));
  } else {
    console.log('5. Input: QUERY FAILED');
  }
  
  if (soundModeResponse.success) {
    const modeMatch = soundModeResponse.data.match(/MS(.+?)(\s|$|\r|\n)/);
    console.log('6. Sound Mode: ' + (modeMatch && modeMatch[1] ? modeMatch[1] : 'PARSING FAILED'));
  } else {
    console.log('6. Sound Mode: QUERY FAILED');
  }
  
  console.log('\nDiagnostics completed.');
}

// Run the diagnostics
runDiagnostics().catch(console.error); 