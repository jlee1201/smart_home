// CommonJS file to test Denon AVR connection directly
const net = require('net');

const IP = '192.168.50.98';
const PORT = 23;

// Function to send command and get a parsed result
function sendDenonCommand(command) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = '';
    
    client.setTimeout(5000);
    
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
      reject(new Error('Connection timeout'));
    });
    
    client.connect(PORT, IP, () => {
      client.write(`${command}\r`);
      
      // Give enough time for full response
      setTimeout(() => {
        client.end();
      }, 1500);
    });
  });
}

// Check all key Denon AVR status in sequence
async function checkDenonStatus() {
  console.log('=== Checking Denon AVR Status Directly ===\n');
  
  try {
    // Check power status first
    console.log('1. Checking power status...');
    const powerResponse = await sendDenonCommand('PW?');
    const isPowered = powerResponse.includes('PWON');
    console.log(`   Power: ${isPowered ? 'ON' : 'OFF'}`);
    
    if (!isPowered) {
      console.log('Device is powered off. Cannot check other statuses.');
      return;
    }
    
    // Check volume
    console.log('\n2. Checking volume...');
    const volumeResponse = await sendDenonCommand('MV?');
    let volume = 'Unknown';
    const volumeMatch = volumeResponse.match(/MV(\d+)/);
    if (volumeMatch && volumeMatch[1]) {
      const volumeValue = volumeMatch[1];
      volume = volumeValue.length >= 3 
        ? `${volumeValue.slice(0, -1)}.${volumeValue.slice(-1)}%` 
        : `${volumeValue}%`;
    }
    console.log(`   Volume: ${volume}`);
    
    // Check mute status
    console.log('\n3. Checking mute status...');
    const muteResponse = await sendDenonCommand('MU?');
    const isMuted = muteResponse.includes('MUON');
    console.log(`   Mute: ${isMuted ? 'ON' : 'OFF'}`);
    
    // Check input
    console.log('\n4. Checking current input...');
    const inputResponse = await sendDenonCommand('SI?');
    let input = 'Unknown';
    const inputMatch = inputResponse.match(/SI(.+?)(\r|\n|$)/);
    if (inputMatch && inputMatch[1]) {
      input = inputMatch[1];
    }
    console.log(`   Input: ${input}`);
    
    // Check sound mode
    console.log('\n5. Checking sound mode...');
    const soundResponse = await sendDenonCommand('MS?');
    let soundMode = 'Unknown';
    const soundMatch = soundResponse.match(/MS(.+?)(\r|\n|$)/);
    if (soundMatch && soundMatch[1]) {
      soundMode = soundMatch[1];
    }
    console.log(`   Sound Mode: ${soundMode}`);
    
    // Summary
    console.log('\n=== Denon AVR Status Summary ===');
    console.log(`Power: ${isPowered ? 'ON' : 'OFF'}`);
    console.log(`Volume: ${volume}`);
    console.log(`Mute: ${isMuted ? 'ON' : 'OFF'}`);
    console.log(`Input: ${input}`);
    console.log(`Sound Mode: ${soundMode}`);
    console.log('\nAll checks completed successfully!');
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error('Connection to Denon AVR failed.');
    console.error('Please check if the device is powered on and connected to the network.');
  }
}

// Run the checks
checkDenonStatus().catch(console.error); 