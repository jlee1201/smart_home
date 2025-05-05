const axios = require('axios');
const https = require('https');

// TV Settings
const TV_IP = '192.168.50.113';
const TV_PORT = 7345;
const AUTH_TOKEN = 'Zhayl****'; // Masked for security, replace with full token from your database

// Helper function to make requests to the Vizio API
async function sendRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `https://${TV_IP}:${TV_PORT}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'AUTH': AUTH_TOKEN
    };
    
    console.log(`Sending ${method} request to ${url}`);
    console.log('Request data:', data ? JSON.stringify(data, null, 2) : 'none');
    
    const response = await axios({
      method,
      url,
      headers,
      data: data,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000, // 10 seconds
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error sending request to ${endpoint}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test functions
async function testGetVolume() {
  console.log('\n=== Testing GET Volume ===');
  const response = await sendRequest('/menu_native/dynamic/tv_settings/audio/volume');
  console.log('GET Volume response:', JSON.stringify(response, null, 2));
  return response;
}

async function testSetVolume(volumeResponse, newVolume) {
  console.log(`\n=== Testing SET Volume to ${newVolume} ===`);
  
  if (!volumeResponse || !volumeResponse.response || !volumeResponse.response.ITEMS || !volumeResponse.response.ITEMS.length) {
    throw new Error('Invalid volume response format');
  }
  
  const volumeItem = volumeResponse.response.ITEMS.find(item => 
    item.NAME === "Volume" || item.CNAME === "volume"
  );
  
  if (!volumeItem || !volumeItem.HASHVAL) {
    throw new Error('Could not find volume HASHVAL in response');
  }
  
  const hashVal = volumeItem.HASHVAL;
  console.log(`Found volume HASHVAL: ${hashVal}`);
  
  // Using the documented format with REQUEST, VALUE, HASHVAL
  const data = {
    REQUEST: "MODIFY",
    VALUE: newVolume,
    HASHVAL: hashVal
  };
  
  const response = await sendRequest('/menu_native/dynamic/tv_settings/audio/volume', 'PUT', data);
  console.log('SET Volume response:', JSON.stringify(response, null, 2));
  return response;
}

async function testGetInput() {
  console.log('\n=== Testing GET Current Input ===');
  const response = await sendRequest('/menu_native/dynamic/tv_settings/devices/current_input');
  console.log('GET Input response:', JSON.stringify(response, null, 2));
  return response;
}

async function testSetInput(inputResponse, newInput) {
  console.log(`\n=== Testing SET Input to ${newInput} ===`);
  
  if (!inputResponse || !inputResponse.response || !inputResponse.response.ITEMS || !inputResponse.response.ITEMS.length) {
    throw new Error('Invalid input response format');
  }
  
  const inputItem = inputResponse.response.ITEMS[0];
  if (!inputItem || !inputItem.HASHVAL) {
    throw new Error('Could not find input HASHVAL in response');
  }
  
  const hashVal = inputItem.HASHVAL;
  console.log(`Found input HASHVAL: ${hashVal}`);
  
  // Using the documented format with REQUEST, VALUE, HASHVAL
  const data = {
    REQUEST: "MODIFY",
    VALUE: newInput,
    HASHVAL: hashVal
  };
  
  const response = await sendRequest('/menu_native/dynamic/tv_settings/devices/current_input', 'PUT', data);
  console.log('SET Input response:', JSON.stringify(response, null, 2));
  return response;
}

async function testKeyPress(key) {
  console.log(`\n=== Testing Key Press: ${key} ===`);
  
  // Format that seems to work best for this TV model
  const data = {
    KEYLIST: [key]
  };
  
  const response = await sendRequest('/key_command/', 'PUT', data);
  console.log('Key Press response:', JSON.stringify(response, null, 2));
  return response;
}

// Run all tests
async function runTests() {
  try {
    // Test volume controls
    const volumeResponse = await testGetVolume();
    const currentVolume = volumeResponse.response.ITEMS[0].VALUE;
    console.log(`Current volume: ${currentVolume}`);
    
    // Set volume to a slightly different level
    const newVolume = currentVolume > 10 ? currentVolume - 5 : currentVolume + 5;
    await testSetVolume(volumeResponse, newVolume);
    
    // Test input controls
    const inputResponse = await testGetInput();
    const currentInput = inputResponse.response.ITEMS[0].VALUE;
    console.log(`Current input: ${currentInput}`);
    
    // Test key press for input select
    if (currentInput === 'HDMI-1') {
      await testKeyPress('INPUT_HDMI2');
    } else {
      await testKeyPress('INPUT_HDMI1');
    }
    
    // Wait a moment for the key press to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the updated input
    const updatedInputResponse = await testGetInput();
    const updatedInput = updatedInputResponse.response.ITEMS[0].VALUE;
    console.log(`Updated input: ${updatedInput}`);
    
    // Try to set input using the API method
    if (updatedInput !== currentInput) {
      await testSetInput(updatedInputResponse, currentInput);
    }
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Start the tests
runTests(); 