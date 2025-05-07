const net = require('net');

// Test volume retrieval from Denon AVR
function testDenonVolume() {
  const IP = '192.168.50.98';
  const PORT = 23;
  const COMMAND = 'MV?';
  
  console.log(`Testing Denon AVR volume response at ${IP}:${PORT}`);
  
  const client = new net.Socket();
  let responseData = '';
  
  client.on('data', (data) => {
    const chunk = data.toString();
    responseData += chunk;
    console.log(`Received data chunk: "${chunk.trim()}"`);
  });
  
  client.on('close', () => {
    console.log(`\nConnection closed. Full response: "${responseData.trim()}"`);
    
    // Try different parsing approaches
    console.log('\nParsing attempts:');
    
    // Approach 1: Simple regex for MV followed by digits
    const simpleMatch = responseData.match(/MV(\d+)/);
    if (simpleMatch) {
      console.log(`Approach 1 (Simple regex): ${simpleMatch[0]} -> Volume value: ${simpleMatch[1]}`);
    } else {
      console.log('Approach 1 (Simple regex): No match found');
    }
    
    // Approach 2: Look for the last MV value in case there are multiple
    const mvMatches = responseData.match(/MV\d+/g);
    if (mvMatches && mvMatches.length > 0) {
      const lastMatch = mvMatches[mvMatches.length - 1];
      const volumeValue = lastMatch.replace('MV', '');
      console.log(`Approach 2 (Last MV match): ${lastMatch} -> Volume value: ${volumeValue}`);
    } else {
      console.log('Approach 2 (Last MV match): No matches found');
    }
    
    // Approach 3: Split the response by lines and look for MV in each line
    const lines = responseData.split(/[\r\n]+/).filter(line => line.trim());
    console.log('Approach 3 (Line by line):');
    lines.forEach((line, index) => {
      console.log(`  Line ${index + 1}: "${line}"`);
      const mvMatch = line.match(/MV(\d+)/);
      if (mvMatch) {
        console.log(`    Found volume: ${mvMatch[1]}`);
      }
    });
    
    // Convert to percentage
    if (simpleMatch && simpleMatch[1]) {
      const volumeValue = parseInt(simpleMatch[1], 10);
      const percentage = Math.round((volumeValue / 99) * 100);
      console.log(`\nVolume as percentage: ${percentage}%`);
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
testDenonVolume(); 