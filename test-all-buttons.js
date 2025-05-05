const { execSync } = require('child_process');

const testButtons = async () => {
  console.log('Testing all navigation buttons with the Vizio TV API...\n');
  
  // Define all the buttons to test
  const buttons = [
    { name: 'UP', codeset: 4, code: 0 },
    { name: 'DOWN', codeset: 4, code: 1 },
    { name: 'LEFT', codeset: 3, code: 2 },
    { name: 'RIGHT', codeset: 4, code: 3 },
    { name: 'BACK', codeset: 4, code: 4 },
    { name: 'OK', codeset: 4, code: 5 },
    { name: 'HOME', codeset: 3, code: 7 },
    { name: 'MENU', codeset: 4, code: 8 }
    // EXIT is excluded as we haven't found a working combination yet
  ];
  
  // Test each button with direct API call
  console.log('Testing direct API calls:');
  for (const button of buttons) {
    try {
      console.log(`\nTesting ${button.name} button with CODESET=${button.codeset}, CODE=${button.code}...`);
      const cmd = `curl -k -X PUT -H "Content-Type: application/json" -H "AUTH: Zhaylem89u" ` +
                 `-d '{"KEYLIST": [{"CODESET": ${button.codeset}, "CODE": ${button.code}, "ACTION": "KEYPRESS"}]}' ` +
                 `https://192.168.50.113:7345/key_command/`;
      
      const result = execSync(cmd, { encoding: 'utf8' });
      
      if (result.includes('"RESULT":"SUCCESS"')) {
        console.log(`✅ ${button.name} button SUCCESS!`);
      } else {
        console.log(`❌ ${button.name} button FAILED: ${result}`);
      }
    } catch (error) {
      console.error(`❌ ${button.name} button ERROR: ${error.message}`);
    }
    
    // Wait a moment between button presses
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Test through GraphQL API
  console.log('\n\nTesting through GraphQL API:');
  for (const button of buttons) {
    try {
      console.log(`\nTesting ${button.name} button through GraphQL...`);
      const cmd = `curl -s "http://localhost:8000/graphql" ` +
                 `-H "Content-Type: application/json" ` +
                 `-d '{"query":"mutation { sendTVCommand(command: \\"${button.name}\\") }"}' `;
      
      const result = execSync(cmd, { encoding: 'utf8' });
      
      if (result.includes('"sendTVCommand":true')) {
        console.log(`✅ ${button.name} button SUCCESS through GraphQL!`);
      } else {
        console.log(`❌ ${button.name} button FAILED through GraphQL: ${result}`);
      }
    } catch (error) {
      console.error(`❌ ${button.name} button ERROR through GraphQL: ${error.message}`);
    }
    
    // Wait a moment between button presses
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\nTest completed!');
};

// Run the test
testButtons().catch(console.error); 