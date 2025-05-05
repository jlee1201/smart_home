const { execSync } = require('child_process');

console.log('FINAL VERIFICATION: Testing all Vizio TV navigation buttons with corrected codes...');

// All navigation buttons with proper codesets/codes from API docs and testing
const buttons = [
  { name: 'UP', description: 'D-Pad Up', codeset: 3, code: 0 },
  { name: 'DOWN', description: 'D-Pad Down', codeset: 3, code: 1 },
  { name: 'LEFT', description: 'D-Pad Left', codeset: 3, code: 2 },
  { name: 'RIGHT', description: 'D-Pad Right', codeset: 4, code: 3 },
  { name: 'BACK', description: 'Navigation Back', codeset: 4, code: 0 },
  { name: 'OK', description: 'D-Pad OK/Select', codeset: 4, code: 5 },
  { name: 'HOME', description: 'Navigation Home', codeset: 3, code: 7 },
  { name: 'MENU', description: 'Navigation Menu', codeset: 4, code: 4 },
  { name: 'EXIT', description: 'Navigation Exit', codeset: 4, code: 1 }
];

// Function to test a direct API call to the TV
const testDirectAPI = async (button) => {
  try {
    console.log(`\nTesting direct API call for ${button.description} (${button.name})`);
    console.log(`Using CODESET=${button.codeset}, CODE=${button.code}`);
    const cmd = `curl -k -X PUT -H "Content-Type: application/json" -H "AUTH: Zhaylem89u" ` +
               `-d '{"KEYLIST": [{"CODESET": ${button.codeset}, "CODE": ${button.code}, "ACTION": "KEYPRESS"}]}' ` +
               `https://192.168.50.113:7345/key_command/`;
    
    const result = execSync(cmd, { encoding: 'utf8' });
    
    if (result.includes('"RESULT":"SUCCESS"')) {
      console.log(`✅ Direct API call SUCCESS!`);
    } else {
      console.log(`❌ Direct API call FAILED: ${result}`);
    }
    
    return { success: result.includes('"RESULT":"SUCCESS"'), result };
  } catch (error) {
    console.error(`❌ ERROR with direct API call: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Function to test via GraphQL API
const testGraphQL = async (button) => {
  try {
    console.log(`Testing GraphQL API for ${button.name}...`);
    const cmd = `curl -s "http://localhost:8000/graphql" ` +
               `-H "Content-Type: application/json" ` +
               `-d '{"query":"mutation { sendTVCommand(command: \\"${button.name}\\") }"}' `;
    
    const result = execSync(cmd, { encoding: 'utf8' });
    
    if (result.includes('"sendTVCommand":true')) {
      console.log(`✅ GraphQL API call SUCCESS!`);
    } else {
      console.log(`❌ GraphQL API call FAILED: ${result}`);
    }
    
    return { success: result.includes('"sendTVCommand":true'), result };
  } catch (error) {
    console.error(`❌ ERROR with GraphQL API call: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Test all buttons
const runTests = async () => {
  console.log('Starting final verification tests...');
  const directResults = {};
  const graphqlResults = {};
  
  // First restart the server to use the updated code
  try {
    console.log('\nRestarting the server to apply code changes...');
    // Use nohup to ensure the server keeps running after the command completes
    execSync('pkill -f nodemon || true', { stdio: 'inherit' });
    execSync('npm run dev > server.log 2>&1 &', { stdio: 'inherit' });
    console.log('Server restarted. Waiting for it to initialize...');
    // Wait for the server to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    console.error('Error restarting server:', error.message);
  }
  
  // Test each button
  for (const button of buttons) {
    console.log(`\n----- Testing ${button.name} (${button.description}) -----`);
    
    // Test direct API call
    directResults[button.name] = await testDirectAPI(button);
    
    // Test GraphQL API
    graphqlResults[button.name] = await testGraphQL(button);
    
    // Wait between button tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print results summary
  console.log('\n\n====== TEST RESULTS SUMMARY ======');
  console.log('Button\t\tDirect API\tGraphQL API');
  console.log('------\t\t----------\t----------');
  
  for (const button of buttons) {
    const directStatus = directResults[button.name].success ? '✅ SUCCESS' : '❌ FAILED';
    const graphqlStatus = graphqlResults[button.name].success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${button.name.padEnd(8)}\t${directStatus}\t${graphqlStatus}`);
  }
  
  // Count successful tests
  const directSuccessCount = Object.values(directResults).filter(r => r.success).length;
  const graphqlSuccessCount = Object.values(graphqlResults).filter(r => r.success).length;
  
  console.log('\nSUCCESS RATE:');
  console.log(`Direct API: ${directSuccessCount}/${buttons.length} (${Math.round(directSuccessCount/buttons.length*100)}%)`);
  console.log(`GraphQL API: ${graphqlSuccessCount}/${buttons.length} (${Math.round(graphqlSuccessCount/buttons.length*100)}%)`);
  
  console.log('\nTest completed!');
};

// Run the tests
runTests().catch(console.error); 