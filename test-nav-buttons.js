const { execSync } = require('child_process');

console.log('Testing Vizio TV navigation buttons with documented codes...');

// According to the Vizio SmartCast API documentation at https://github.com/exiva/Vizio_SmartCast_API:
// D-Pad navigation should use CODESET 3
// Nav buttons should use CODESET 4

// Test matrix for navigation buttons
const buttons = [
  { name: 'UP', description: 'D-Pad Up', codeset: 3, code: 0 },
  { name: 'DOWN', description: 'D-Pad Down', codeset: 3, code: 1 },
  { name: 'LEFT', description: 'D-Pad Left', codeset: 3, code: 2 },
  { name: 'RIGHT', description: 'D-Pad Right', codeset: 3, code: 3 },
  { name: 'OK', description: 'D-Pad OK/Select', codeset: 3, code: 4 },
  { name: 'BACK', description: 'Nav Back', codeset: 4, code: 0 },
  { name: 'EXIT', description: 'Nav Exit', codeset: 4, code: 1 },
  { name: 'HOME', description: 'Nav Home', codeset: 4, code: 2 },
  { name: 'MENU', description: 'Nav Menu', codeset: 4, code: 4 }
];

// Function to test a specific button
const testButton = (button) => {
  try {
    console.log(`\nTesting ${button.description} (${button.name}) with CODESET=${button.codeset}, CODE=${button.code}`);
    const cmd = `curl -k -X PUT -H "Content-Type: application/json" -H "AUTH: Zhaylem89u" ` +
               `-d '{"KEYLIST": [{"CODESET": ${button.codeset}, "CODE": ${button.code}, "ACTION": "KEYPRESS"}]}' ` +
               `https://192.168.50.113:7345/key_command/`;
    
    const result = execSync(cmd, { encoding: 'utf8' });
    
    if (result.includes('"RESULT":"SUCCESS"')) {
      console.log(`✅ ${button.name} button SUCCESS!`);
    } else {
      console.log(`❌ ${button.name} button FAILED: ${result}`);
    }
    
    return { success: result.includes('"RESULT":"SUCCESS"'), result };
  } catch (error) {
    console.error(`❌ ${button.name} button ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Test all buttons
const runTests = async () => {
  console.log('Starting tests according to Vizio API documentation...');
  const results = {};
  
  for (const button of buttons) {
    results[button.name] = await testButton(button);
    // Wait a moment between button presses
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n--- TEST SUMMARY ---');
  for (const button of buttons) {
    const status = results[button.name].success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${button.name} (${button.description}): ${status}`);
  }
  
  console.log('\nTest completed!');
};

// Run the tests
runTests().catch(console.error); 