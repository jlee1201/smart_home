const axios = require('axios');

// Test both volume and input control functionality
async function testFixes() {
  try {
    console.log('Testing API fixes...');
    
    // Check current TV status first
    const initialStatusResponse = await axios.post('http://localhost:8001/graphql', {
      query: `
        query {
          tvStatus {
            volume
            isPoweredOn
            input
            isMuted
            supportedInputs
          }
        }
      `
    });
    
    console.log('Initial TV status:', initialStatusResponse.data);
    
    // Test volume control via sendTVCommand
    console.log('\nTesting volume control:');
    const volumeResponse = await axios.post('http://localhost:8001/graphql', {
      query: `
        mutation {
          sendTVCommand(command: "VOLUME", value: "20")
        }
      `
    });
    
    console.log('Volume control response:', volumeResponse.data);
    
    // Wait a moment for changes to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check TV status after volume change
    const midStatusResponse = await axios.post('http://localhost:8001/graphql', {
      query: `
        query {
          tvStatus {
            volume
            isPoweredOn
            input
            isMuted
          }
        }
      `
    });
    
    console.log('TV status after volume change:', midStatusResponse.data);
    
    // Test input control via updateInput
    console.log('\nTesting input control:');
    const inputResponse = await axios.post('http://localhost:8001/graphql', {
      query: `
        mutation {
          updateInput(value: "HDMI_1")
        }
      `
    });
    
    console.log('Input control response:', inputResponse.data);
    
    // Wait a moment for changes to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check TV status again to verify changes
    const finalStatusResponse = await axios.post('http://localhost:8001/graphql', {
      query: `
        query {
          tvStatus {
            volume
            isPoweredOn
            input
            isMuted
          }
        }
      `
    });
    
    console.log('Final TV status after input change:', finalStatusResponse.data);
    
    console.log('\nTests completed successfully!');
  } catch (error) {
    console.error('Error testing fixes:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Wait a few seconds for server to start before testing
console.log('Waiting for server to start...');
setTimeout(testFixes, 5000); 