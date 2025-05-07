// Script to check environment variables
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('=== Checking Environment Variables ===\n');

// 1. Read .env file
try {
  console.log('1. Reading .env file...');
  const envPath = path.resolve(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('   No .env file found at', envPath);
  } else {
    const envFileContent = fs.readFileSync(envPath, 'utf8');
    console.log('\n.env file content:');
    console.log(envFileContent);
    
    // Check for duplicate entries
    const envLines = envFileContent.split('\n');
    const envVars = {};
    const duplicates = [];
    
    envLines.forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;
      
      const match = line.match(/^\s*([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (envVars[key]) {
          duplicates.push(key);
        }
        envVars[key] = value;
      }
    });
    
    if (duplicates.length > 0) {
      console.log('\nWARNING: Found duplicate entries in .env file:');
      duplicates.forEach(key => {
        console.log(`   - ${key}`);
      });
      console.log('\nThis can cause inconsistent behavior!');
    } else {
      console.log('\nNo duplicate entries found in .env file.');
    }
  }
} catch (error) {
  console.error('Error reading .env file:', error.message);
}

// 2. Load environment variables
console.log('\n2. Loading environment variables...');
dotenv.config();

// 3. Check critical variables for Denon AVR
console.log('\n3. Checking Denon AVR environment variables:');
console.log(`   ENABLE_AVR_CONNECTION: ${process.env.ENABLE_AVR_CONNECTION}`);
console.log(`   DENON_AVR_IP: ${process.env.DENON_AVR_IP}`);
console.log(`   DENON_AVR_PORT: ${process.env.DENON_AVR_PORT || '23 (default)'}`);

// 4. Check which variable is used when loading the config
console.log('\n4. Analyzing environment variable interpretation:');
const enableAvrConnection = process.env.ENABLE_AVR_CONNECTION;
console.log(`   ENABLE_AVR_CONNECTION value type: ${typeof enableAvrConnection}`);
console.log(`   Is "true" string equal to true? ${enableAvrConnection === true}`);
console.log(`   String comparison: "${enableAvrConnection}" === "true" -> ${enableAvrConnection === "true"}`);
console.log(`   Converted to boolean: Boolean("${enableAvrConnection}") -> ${Boolean(enableAvrConnection)}`);

// 5. Simulate the actual check used in the server code
console.log('\n5. Simulating the server check for ENABLE_AVR_CONNECTION:');
const simulationMode = process.env.ENABLE_AVR_CONNECTION !== 'true';
console.log(`   process.env.ENABLE_AVR_CONNECTION !== 'true' -> ${simulationMode}`);
console.log(`   This means the server will run in ${simulationMode ? 'SIMULATION MODE' : 'REAL DEVICE MODE'}`);

// 6. Summary
console.log('\n=== Environment Check Summary ===');
if (simulationMode) {
  console.log('WARNING: The server is running in SIMULATION MODE based on environment variables.');
  console.log('This would explain why the webapp shows the AVR as powered off.');
  console.log('\nTo fix this:');
  console.log('1. Make sure ENABLE_AVR_CONNECTION=true in your .env file');
  console.log('2. Remove any duplicate entries in the .env file');
  console.log('3. Restart the server completely (not just nodemon reload)');
} else {
  console.log('Environment variables are correctly set for connecting to the real Denon AVR.');
  console.log('If issues persist, the problem might be in the API implementation or how the response is parsed.');
} 