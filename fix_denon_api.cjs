const net = require('net');

// Fix Denon AVR API issues
async function fixDenonApi() {
  const IP = '192.168.50.98';
  const PORT = 23;
  
  console.log(`=== Denon AVR-X4500H API Fix Tool ===`);
  console.log(`IP: ${IP}, Port: ${PORT}\n`);
  
  // Test 1: Power state detection
  console.log('TEST 1: Power State Detection');
  const powerState = await testCommand('PW?', 'Power state');
  const isPoweredOn = powerState.includes('PWON');
  console.log(`Result: Power is ${isPoweredOn ? 'ON' : 'OFF'}`);
  console.log('-------------------------------\n');
  
  // Test 2: Volume detection
  console.log('TEST 2: Volume Detection');
  if (isPoweredOn) {
    const volumeResponse = await testCommand('MV?', 'Volume');
    
    console.log('Attempting to parse volume:');
    // First approach: look for lines that start with MV followed by digits only
    const mvLines = volumeResponse.split(/[\r\n]+/)
      .filter(line => line.trim().match(/^MV\d+$/));
    
    if (mvLines.length > 0) {
      const volumeValue = parseInt(mvLines[0].replace('MV', ''), 10);
      console.log(`  Parsed volume using line matching: ${volumeValue} (${Math.round((volumeValue / 99) * 100)}%)`);
    } else {
      console.log('  No direct MV match found');
    }
    
    // Second approach: regex match
    const volumeMatch = volumeResponse.match(/MV(\d+)/);
    if (volumeMatch && volumeMatch[1]) {
      const volumeValue = parseInt(volumeMatch[1], 10);
      console.log(`  Parsed volume using regex: ${volumeValue} (${Math.round((volumeValue / 99) * 100)}%)`);
    } else {
      console.log('  No regex match found');
    }
  } else {
    console.log('Device is off, skipping volume test');
  }
  console.log('-------------------------------\n');
  
  // Test 3: Input detection
  console.log('TEST 3: Input Detection');
  if (isPoweredOn) {
    const inputResponse = await testCommand('SI?', 'Input');
    
    // Parse input
    const inputMatch = inputResponse.match(/SI(.+)/);
    if (inputMatch && inputMatch[1]) {
      console.log(`Current input: ${inputMatch[1]}`);
    } else {
      console.log('Could not parse input response');
    }
  } else {
    console.log('Device is off, skipping input test');
  }
  console.log('-------------------------------\n');
  
  // Test 4: Sound mode detection
  console.log('TEST 4: Sound Mode Detection');
  if (isPoweredOn) {
    const soundModeResponse = await testCommand('MS?', 'Sound mode');
    
    // Parse sound mode
    const modeMatch = soundModeResponse.match(/MS(.+)/);
    if (modeMatch && modeMatch[1]) {
      console.log(`Current sound mode: ${modeMatch[1]}`);
    } else {
      console.log('Could not parse sound mode response');
    }
  } else {
    console.log('Device is off, skipping sound mode test');
  }
  console.log('-------------------------------\n');
  
  // Test 5: Mute state
  console.log('TEST 5: Mute State');
  if (isPoweredOn) {
    const muteResponse = await testCommand('MU?', 'Mute state');
    
    const isMuted = muteResponse.includes('MUON');
    console.log(`Mute state: ${isMuted ? 'MUTED' : 'NOT MUTED'}`);
  } else {
    console.log('Device is off, skipping mute test');
  }
  console.log('-------------------------------\n');
  
  // Summary and recommendations
  console.log('=== SUMMARY ===');
  console.log(`1. Power state: ${isPoweredOn ? 'ON' : 'OFF'}`);
  
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('Based on testing, make the following code changes:');
  
  if (!isPoweredOn) {
    console.log('1. The device is currently OFF. Try turning it on using the remote');
    console.log('   or by sending the PWON command via Telnet.');
  } else {
    console.log('1. Power state detection:');
    console.log('   - Make sure to check for "PWON" in the response data');
    console.log('   - The current response includes multiple lines with Zone info');
    
    console.log('\n2. Volume detection:');
    console.log('   - Check that the device is powered on before getting volume');
    console.log('   - Split the response by newlines and find the line matching "MV\\d+"');
    console.log('   - As a fallback, use the regex approach to match "MV" followed by digits');
    
    console.log('\n3. Input and Sound Mode:');
    console.log('   - Make sure to check for null or empty responses');
    console.log('   - The device might send multi-line responses');
  }
}

// Helper function to test a command
async function testCommand(command, description) {
  return new Promise((resolve) => {
    console.log(`Sending ${description} command: ${command}`);
    
    const client = new net.Socket();
    let responseData = '';
    
    client.on('data', (data) => {
      const chunk = data.toString();
      responseData += chunk;
      console.log(`  Received chunk: "${chunk.trim()}"`);
    });
    
    client.on('close', () => {
      console.log(`  Connection closed. Full response: "${responseData.trim()}"`);
      resolve(responseData.trim());
    });
    
    client.on('error', (error) => {
      console.error(`  Error: ${error.message}`);
      resolve('');
    });
    
    client.connect(23, '192.168.50.98', () => {
      client.write(`${command}\r`);
      
      setTimeout(() => {
        client.end();
      }, 2000);
    });
  });
}

// Run the test and fix process
fixDenonApi(); 