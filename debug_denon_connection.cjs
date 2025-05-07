const net = require('net');

// Connection debug for Denon AVR
function debugDenonConnection() {
  const IP = '192.168.50.98';
  const PORT = 23;
  
  console.log(`=== Denon AVR-X4500H Connection Debug ===`);
  console.log(`Testing connection to ${IP}:${PORT}\n`);
  
  // Test basic TCP connection
  console.log('TEST 1: Basic TCP Connection');
  const client = new net.Socket();
  
  // Set a longer timeout for better visibility
  client.setTimeout(5000);
  
  client.on('connect', () => {
    console.log('SUCCESS: TCP connection established');
    
    // Send a command to test data flow
    console.log('\nSending PW? command to test data flow...');
    client.write('PW?\r');
  });
  
  client.on('timeout', () => {
    console.error('ERROR: Connection timed out');
    client.destroy();
  });
  
  client.on('error', (error) => {
    console.error(`ERROR: ${error.message}`);
    console.error('Check if the IP address is correct and the device is on');
    console.error('Check if port 23 is open and not blocked by a firewall');
    console.error('Check if the device is connected to the network');
    client.destroy();
  });
  
  client.on('data', (data) => {
    console.log(`SUCCESS: Received response: "${data.toString().trim()}"`);
  });
  
  client.on('close', (hadError) => {
    if (!hadError) {
      console.log('Connection closed normally');
    } else {
      console.error('Connection closed due to an error');
    }
    
    console.log('\n=== RECOMMENDATIONS ===');
    console.log('1. Verify the device is powered on');
    console.log('2. Verify network connectivity (try pinging the device)');
    console.log('3. Check for any firewall rules blocking port 23');
    console.log('4. Ensure no other application is using the connection');
    console.log('\nIf problems persist, try power cycling the Denon AVR.');
  });
  
  // Connect to the AVR
  console.log(`Attempting to connect to ${IP}:${PORT}...`);
  client.connect(PORT, IP);
}

// Run the debug function
debugDenonConnection(); 