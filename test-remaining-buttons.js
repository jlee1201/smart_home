const { execSync } = require('child_process');

console.log('Testing remaining Vizio TV navigation buttons with alternative codesets...');

// Test matrix for remaining navigation buttons with different codesets
const buttons = [
  // Test RIGHT button with different codesets
  { name: 'RIGHT', description: 'D-Pad Right', codeset: 4, code: 3 },
  
  // Test OK button with different codesets
  { name: 'OK', description: 'D-Pad OK/Select', codeset: 4, code: 5 },
  
  // Test HOME button with different codesets
  { name: 'HOME', description: 'Nav Home', codeset: 3, code: 7 }
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
  console.log('Starting tests with alternative codesets...');
  const results = {};
  
  for (const button of buttons) {
    results[`${button.name}_${button.codeset}_${button.code}`] = await testButton(button);
    // Wait a moment between button presses
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n--- TEST SUMMARY ---');
  for (const button of buttons) {
    const key = `${button.name}_${button.codeset}_${button.code}`;
    const status = results[key].success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${button.name} with CODESET=${button.codeset}, CODE=${button.code}: ${status}`);
  }
  
  console.log('\nTest completed!');
};

// Run the tests
runTests().catch(console.error); 