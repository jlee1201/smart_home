const net = require('net');

// Test power state of Denon AVR
function testDenonPower() {
  const IP = '192.168.50.98';
  const PORT = 23;
  const COMMAND = 'PW?';
  
  console.log(`Testing Denon AVR power state at ${IP}:${PORT}`);
  
  const client = new net.Socket();
  let responseData = '';
  
  client.on('data', (data) => {
    const chunk = data.toString();
    responseData += chunk;
    console.log(`Received data chunk: "${chunk.trim()}"`);
  });
  
  client.on('close', () => {
    console.log(`\nConnection closed. Full response: "${responseData.trim()}"`);
    
    console.log('\nParsing:');
    if (responseData.includes('PWON')) {
      console.log('Power state: ON');
    } else if (responseData.includes('PWSTANDBY')) {
      console.log('Power state: OFF (standby)');
    } else {
      console.log('Power state: UNKNOWN');
    }
    
    // Test manual power on if the device is off
    if (responseData.includes('PWSTANDBY')) {
      console.log('\nAttempting to power on the AVR...');
      
      const powerOnClient = new net.Socket();
      powerOnClient.connect(PORT, IP, () => {
        console.log('Connected, sending PWON command');
        powerOnClient.write('PWON\r');
        
        setTimeout(() => {
          powerOnClient.end();
        }, 2000);
      });
      
      powerOnClient.on('data', (data) => {
        console.log(`Power on response: "${data.toString().trim()}"`);
      });
      
      powerOnClient.on('close', () => {
        console.log('Power on command completed');
      });
      
      powerOnClient.on('error', (error) => {
        console.error('Error sending power on command:', error.message);
      });
    }
  });
  
  client.on('error', (error) => {
    console.error('Error connecting to Denon AVR:', error.message);
    client.destroy();
  });
  
  client.connect(PORT, IP, () => {
    console.log(`Connected to ${IP}:${PORT}, sending command: ${COMMAND}`);
    client.write(`${COMMAND}\r`);
    
    // Wait a bit for the response before closing
    setTimeout(() => {
      client.end();
    }, 2000);
  });
}

// Run the test
testDenonPower(); 