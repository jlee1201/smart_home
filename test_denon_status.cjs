// Test Denon power status detection
const net = require('net');

const IP = '192.168.50.98';
const PORT = 23;

async function testPowerStatus() {
  console.log('=== Denon Power Status Test ===');
  console.log(`Testing connection to ${IP}:${PORT}...\n`);
  
  const client = new net.Socket();
  let responseData = '';
  
  return new Promise((resolve, reject) => {
    client.setTimeout(5000);
    
    client.on('connect', () => {
      console.log('Connected successfully!');
      console.log('Sending PW? command...');
      client.write('PW?\r');
    });
    
    client.on('data', (data) => {
      const chunk = data.toString();
      responseData += chunk;
      console.log(`Received chunk: "${chunk.trim()}"`);
    });
    
    client.on('close', () => {
      console.log('\nConnection closed');
      console.log(`Complete response: "${responseData.trim()}"`);
      
      // Parse response
      const lines = responseData.split(/[\r\n]+/).map(line => line.trim());
      console.log('\nResponse by line:');
      lines.forEach((line, i) => {
        console.log(`  Line ${i+1}: "${line}"`);
      });
      
      const hasPwOnLine = lines.some(line => line === 'PWON' || line.startsWith('PWON'));
      const containsPwOn = responseData.includes('PWON');
      
      console.log('\nPower status detection:');
      console.log(`  Contains PWON anywhere: ${containsPwOn}`);
      console.log(`  Has PWON as line: ${hasPwOnLine}`);
      console.log(`  Power is: ${(hasPwOnLine || containsPwOn) ? 'ON' : 'OFF'}`);
      
      resolve();
    });
    
    client.on('error', (error) => {
      console.error(`ERROR: ${error.message}`);
      reject(error);
    });
    
    client.on('timeout', () => {
      console.error('Connection timed out');
      client.destroy();
      reject(new Error('Connection timeout'));
    });
    
    // Connect to the AVR
    client.connect(PORT, IP);
  });
}

// Run the test
testPowerStatus()
  .then(() => console.log('\nTest completed successfully'))
  .catch(error => console.error('Test failed:', error)); 