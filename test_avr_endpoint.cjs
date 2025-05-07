// CommonJS script to test the GraphQL endpoint
const http = require('http');

// Function to make a GraphQL request
function makeGraphQLRequest(query) {
  return new Promise((resolve, reject) => {
    // GraphQL query as POST data
    const postData = JSON.stringify({
      query: query
    });
    
    // Request options
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // Make request
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    // Send the query
    req.write(postData);
    req.end();
  });
}

// Main function to test the AVR status endpoint
async function testAvrStatus() {
  console.log('=== Testing Denon AVR Status GraphQL Endpoint ===\n');
  
  try {
    // Step 1: Query the AVR status
    console.log('1. Querying AVR status...');
    const query = `
      query {
        denonAvrStatus {
          isPoweredOn
          volume
          isMuted
          input
          soundMode
        }
        denonAvrConnectionStatus {
          connected
        }
      }
    `;
    
    const result = await makeGraphQLRequest(query);
    console.log('\nResponse from server:');
    console.log(JSON.stringify(result, null, 2));
    
    // Step 2: Compare with direct connection results
    console.log('\n2. Analyzing response...');
    
    if (result.errors) {
      console.error('\nGraphQL errors occurred:');
      result.errors.forEach((error, index) => {
        console.error(`  Error ${index + 1}: ${error.message}`);
      });
      return;
    }
    
    // Check connection status
    const isConnected = result.data?.denonAvrConnectionStatus?.connected === true;
    console.log(`Connection status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    if (!isConnected) {
      console.log('\nThe server reports that the AVR is not connected.');
      console.log('This conflicts with our direct test which showed a connection was possible.');
      console.log('Possible issues:');
      console.log('1. The environment variable ENABLE_AVR_CONNECTION might be set to "false"');
      console.log('2. The server might be in simulation mode');
      console.log('3. The server might be running with different connection parameters');
      return;
    }
    
    // Check power status
    const status = result.data?.denonAvrStatus;
    if (!status) {
      console.log('\nNo AVR status returned from server.');
      return;
    }
    
    console.log('\nAVR Status from GraphQL API:');
    console.log(`Power: ${status.isPoweredOn ? 'ON' : 'OFF'}`);
    console.log(`Volume: ${status.volume}%`);
    console.log(`Mute: ${status.isMuted ? 'ON' : 'OFF'}`);
    console.log(`Input: ${status.input}`);
    console.log(`Sound Mode: ${status.soundMode}`);
    
    // Step 3: Send a refresh command to test command handling
    console.log('\n3. Sending a power status command to verify command handling...');
    const commandQuery = `
      mutation {
        sendDenonAvrCommand(command: "POWER_STATUS")
      }
    `;
    
    const commandResult = await makeGraphQLRequest(commandQuery);
    console.log('Command response:');
    console.log(JSON.stringify(commandResult, null, 2));
    
    // Step 4: Query again to see if status updated
    console.log('\n4. Querying status again after command...');
    const updatedResult = await makeGraphQLRequest(query);
    const updatedStatus = updatedResult.data?.denonAvrStatus;
    
    if (updatedStatus) {
      console.log('\nUpdated AVR Status:');
      console.log(`Power: ${updatedStatus.isPoweredOn ? 'ON' : 'OFF'}`);
      console.log(`Volume: ${updatedStatus.volume}%`);
      console.log(`Mute: ${updatedStatus.isMuted ? 'ON' : 'OFF'}`);
      console.log(`Input: ${updatedStatus.input}`);
      console.log(`Sound Mode: ${updatedStatus.soundMode}`);
    }
    
    // Step 5: Final analysis
    console.log('\n=== Test Conclusions ===');
    if (status.isPoweredOn === false && updatedStatus?.isPoweredOn === false) {
      console.log('ISSUE DETECTED: Server consistently reports AVR is powered off.');
      console.log('This conflicts with our direct tests that showed the AVR is ON.');
      console.log('\nPossible causes:');
      console.log('1. The environment variable ENABLE_AVR_CONNECTION might be set to "false"');
      console.log('2. The server\'s DENON_AVR_IP might be pointing to a different device');
      console.log('3. There might be a bug in how the server parses the "PWON" response');
    } else if (status.isPoweredOn !== updatedStatus?.isPoweredOn) {
      console.log('Status inconsistency detected: Power state changed between queries.');
      console.log('This suggests the AVR status is being updated but might not be stable.');
    } else {
      console.log('Test completed. Check the reported status against the actual AVR status.');
    }
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error('Failed to test the GraphQL endpoint.');
    console.error('Make sure the server is running on http://localhost:8000/graphql');
  }
}

// Run the test
testAvrStatus().catch(console.error); 