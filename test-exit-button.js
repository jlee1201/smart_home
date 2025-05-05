const { execSync } = require('child_process');

const testExitButton = async () => {
  console.log('Testing EXIT button with various codes and codesets...\n');
  
  // Try different combinations of codesets and codes for EXIT
  const codesets = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  const codes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 158, 174];
  
  for (const codeset of codesets) {
    for (const code of codes) {
      try {
        console.log(`Testing EXIT with CODESET=${codeset}, CODE=${code}...`);
        const cmd = `curl -k -X PUT -H "Content-Type: application/json" -H "AUTH: Zhaylem89u" ` +
                   `-d '{"KEYLIST": [{"CODESET": ${codeset}, "CODE": ${code}, "ACTION": "KEYPRESS"}]}' ` +
                   `https://192.168.50.113:7345/key_command/`;
        
        const result = execSync(cmd, { encoding: 'utf8' });
        
        if (result.includes('"RESULT":"SUCCESS"')) {
          console.log(`✅ EXIT button SUCCESS with CODESET=${codeset}, CODE=${code}!\n${result}\n`);
          // Record the successful combination
          execSync(`echo "EXIT button works with CODESET=${codeset}, CODE=${code}" >> exit-button-results.txt`);
        }
      } catch (error) {
        // Ignore errors to keep testing all combinations
      }
      
      // Short delay between attempts
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\nTest completed! Check exit-button-results.txt for successful combinations.');
};

// Run the test
testExitButton().catch(console.error); 