// Verify Denon AVR Connection (CommonJS version)
// Simple script to test the connection to the Denon AVR and display current status
const net = require('net');

const IP = '192.168.50.98';
const PORT = 23;

// Helper function to send a command and await a response
function sendCommand(command) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = '';
    
    client.setTimeout(3000);
    
    client.on('data', (data) => {
      responseData += data.toString();
    });
    
    client.on('close', () => {
      resolve(responseData.trim());
    });
    
    client.on('error', (error) => {
      reject(error);
    });
    
    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Connection timed out'));
    });
    
    client.connect(PORT, IP, () => {
      client.write(`${command}\r`);
      
      // Give it time to receive the full response
      setTimeout(() => {
        client.end();
      }, 1000);
    });
  });
}

// Main verification function
async function verifyConnection() {
  console.log('=== Denon AVR Connection Verification ===');
  console.log(`Testing connection to ${IP}:${PORT}...\n`);
  
  try {
    // Test power status
    console.log('1. Testing power status...');
    const powerResponse = await sendCommand('PW?');
    const powerStatus = powerResponse.includes('PWON') ? 'ON' : 'OFF';
    console.log(`   Power status: ${powerStatus}`);
    console.log(`   Raw response: ${powerResponse}\n`);
    
    if (!powerResponse.includes('PWON')) {
      console.log('Device is powered off. Cannot get further status information.');
      return;
    }
    
    // Get volume level
    console.log('2. Testing volume retrieval...');
    const volumeResponse = await sendCommand('MV?');
    // Extract volume from format like MV515 (51.5%) or MV50 (50%)
    let volumeMatch = volumeResponse.match(/MV(\d+)/);
    let volume = 'Unknown';
    
    if (volumeMatch && volumeMatch[1]) {
      const volumeValue = volumeMatch[1];
      volume = volumeValue.length >= 3 
        ? `${volumeValue.slice(0, -1)}.${volumeValue.slice(-1)}%` 
        : `${volumeValue}%`;
    }
    
    console.log(`   Current volume: ${volume}`);
    console.log(`   Raw response: ${volumeResponse}\n`);
    
    // Get mute status
    console.log('3. Testing mute status...');
    const muteResponse = await sendCommand('MU?');
    const muteStatus = muteResponse.includes('MUON') ? 'MUTED' : 'NOT MUTED';
    console.log(`   Mute status: ${muteStatus}`);
    console.log(`   Raw response: ${muteResponse}\n`);
    
    // Get current input
    console.log('4. Testing input status...');
    const inputResponse = await sendCommand('SI?');
    let inputMatch = inputResponse.match(/SI(.+)/);
    const inputStatus = inputMatch ? inputMatch[1] : 'Unknown';
    console.log(`   Current input: ${inputStatus}`);
    console.log(`   Raw response: ${inputResponse}\n`);
    
    // Get sound mode
    console.log('5. Testing sound mode...');
    const soundResponse = await sendCommand('MS?');
    let soundMatch = soundResponse.match(/MS(.+)/);
    const soundMode = soundMatch ? soundMatch[1] : 'Unknown';
    console.log(`   Current sound mode: ${soundMode}`);
    console.log(`   Raw response: ${soundResponse}\n`);
    
    console.log('=== Connection Test Complete ===');
    console.log('All tests passed. Connection to Denon AVR is working properly!');
    
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
verifyConnection().catch(error => {
  console.error('Unhandled error:', error);
}); 