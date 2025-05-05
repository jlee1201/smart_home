const { Pool } = require('pg');
const https = require('https');
const axios = require('axios');

// Create a function to get the auth token from the database
async function getAuthToken() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5433/smart_home'
  });

  try {
    const result = await pool.query('SELECT * FROM "TVSettings" LIMIT 1');
    await pool.end();
    
    if (result.rows.length > 0) {
      console.log('Found TV settings:', result.rows[0]);
      return result.rows[0];
    } else {
      console.log('No TV settings found in database');
      return null;
    }
  } catch (err) {
    console.error('Error querying database:', err);
    await pool.end();
    return null;
  }
}

// Make a test GET request to the Vizio API
async function testGetRequest(ip, port, authToken) {
  try {
    const response = await axios({
      method: 'GET',
      url: `https://${ip}:${port}/state/device/power_mode`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('GET request successful:');
    console.log(response.data);
    return response.data;
  } catch (err) {
    console.error('Error making GET request:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test a volume PUT request to the Vizio API with the documented format
async function testVolumePutRequest(ip, port, authToken, volume) {
  try {
    // First check the current menu_native endpoint to get the HASHVAL
    const menuResponse = await axios({
      method: 'GET',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/audio/volume`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('GET volume endpoint response:');
    console.log(JSON.stringify(menuResponse.data, null, 2));
    
    // Find the volume item and get its HASHVAL
    const volumeItem = menuResponse.data.ITEMS.find(item => item.NAME === "Volume");
    if (!volumeItem) {
      console.error('Could not find volume item in response');
      return null;
    }
    
    const hashVal = volumeItem.HASHVAL;
    console.log(`Found volume HASHVAL: ${hashVal}`);
    
    // Now make the PUT request with the hashval
    console.log(`Attempting to set volume to ${volume}`);
    const putResponse = await axios({
      method: 'PUT',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/audio/volume`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      data: {
        REQUEST: "MODIFY",
        VALUE: volume,
        HASHVAL: hashVal
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('PUT request successful:');
    console.log(putResponse.data);
    return putResponse.data;
  } catch (err) {
    console.error('Error making PUT request:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test getting current input
async function testGetInput(ip, port, authToken) {
  try {
    const response = await axios({
      method: 'GET',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/devices/current_input`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('GET current input response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (err) {
    console.error('Error getting current input:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test getting input list
async function testGetInputList(ip, port, authToken) {
  try {
    const response = await axios({
      method: 'GET',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/devices/name_input`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('GET input list response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (err) {
    console.error('Error getting input list:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test setting input with documented format
async function testSetInput(ip, port, authToken, inputName) {
  try {
    // First get the current input to get the HASHVAL
    const currentInputResponse = await axios({
      method: 'GET',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/devices/current_input`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    const hashVal = currentInputResponse.data.ITEMS[0].HASHVAL;
    console.log(`Current input HASHVAL: ${hashVal}`);
    
    // Now make the PUT request to change input using the documentation format
    console.log(`Attempting to set input to ${inputName} using documentation format`);
    const putResponse = await axios({
      method: 'PUT',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/devices/current_input`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      data: {
        REQUEST: "MODIFY",
        VALUE: inputName,
        HASHVAL: hashVal
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('PUT input request successful:');
    console.log(putResponse.data);
    return putResponse.data;
  } catch (err) {
    console.error('Error setting input:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test setting input with API item format
async function testSetInputItemsFormat(ip, port, authToken, inputName) {
  try {
    console.log(`Attempting to set input to ${inputName} using ITEMS format`);
    const putResponse = await axios({
      method: 'PUT',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/devices/current_input`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      data: {
        REQUEST: "MODIFY",
        ITEMS: [{
          NAME: "Current Input",
          VALUE: inputName
        }]
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('PUT input request with ITEMS format successful:');
    console.log(putResponse.data);
    return putResponse.data;
  } catch (err) {
    console.error('Error setting input with ITEMS format:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test alternate input endpoint format
async function testSetInputWithNameEndpoint(ip, port, authToken, inputName) {
  try {
    console.log(`Attempting to set input to ${inputName} using NAME endpoint`);
    const putResponse = await axios({
      method: 'PUT',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/devices/current_input/NAME`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      data: {
        DEVICE_NAME: "Smart Home Remote",
        DEVICE_ID: settings.deviceId,
        INPUT_NAME: inputName
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('PUT input NAME endpoint request successful:');
    console.log(putResponse.data);
    return putResponse.data;
  } catch (err) {
    console.error('Error setting input with NAME endpoint:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test the alternative "API" format request
async function testApiStylePutRequest(ip, port, authToken, volume) {
  try {
    console.log(`Attempting to set volume to ${volume} using API format`);
    const putResponse = await axios({
      method: 'PUT',
      url: `https://${ip}:${port}/menu_native/dynamic/tv_settings/audio/volume`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      data: {
        REQUEST: "MODIFY",
        ITEMS: [{
          NAME: "Volume",
          VALUE: volume
        }]
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('PUT request successful:');
    console.log(putResponse.data);
    return putResponse.data;
  } catch (err) {
    console.error('Error making PUT request:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Test a key press to change input
async function testKeyPressInput(ip, port, authToken, inputNum) {
  try {
    console.log(`Attempting to send key press for HDMI-${inputNum}`);
    const putResponse = await axios({
      method: 'PUT',
      url: `https://${ip}:${port}/key_command/`,
      headers: {
        'Content-Type': 'application/json',
        'AUTH': authToken
      },
      data: {
        KEYLIST: [{
          CODESET: 7,
          CODE: inputNum,
          ACTION: "KEYPRESS"
        }]
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000
    });
    
    console.log('Key press request successful:');
    console.log(putResponse.data);
    return putResponse.data;
  } catch (err) {
    console.error('Error sending key press:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
    }
    return null;
  }
}

// Global variable to store settings
let settings;

// Main function
async function main() {
  settings = await getAuthToken();
  
  if (!settings || !settings.authToken) {
    console.error('Cannot proceed without auth token');
    return;
  }
  
  const { ip, port, authToken } = settings;
  
  // Basic tests
  console.log("\n=== BASIC GET TESTS ===");
  await testGetRequest(ip, port, authToken);
  
  // Get current input
  console.log("\n=== CURRENT INPUT TEST ===");
  await testGetInput(ip, port, authToken);
  
  // Get list of inputs
  console.log("\n=== INPUT LIST TEST ===");
  await testGetInputList(ip, port, authToken);
  
  // Test setting input using the documented format
  console.log("\n=== SET INPUT TEST (DOCUMENTED FORMAT) ===");
  await testSetInput(ip, port, authToken, "HDMI-1");
  
  // Test setting input using the ITEMS format
  console.log("\n=== SET INPUT TEST (ITEMS FORMAT) ===");
  await testSetInputItemsFormat(ip, port, authToken, "HDMI-2");
  
  // Test setting input using the NAME endpoint
  console.log("\n=== SET INPUT TEST (NAME ENDPOINT) ===");
  await testSetInputWithNameEndpoint(ip, port, authToken, "HDMI-3");
  
  // Test sending a key press to change input
  console.log("\n=== KEY PRESS INPUT TEST ===");
  await testKeyPressInput(ip, port, authToken, 1); // Should switch to HDMI-1
  
  // Volume tests
  console.log("\n=== VOLUME TESTS ===");
  await testVolumePutRequest(ip, port, authToken, 20);
  await testApiStylePutRequest(ip, port, authToken, 25);
}

main().catch(console.error); 