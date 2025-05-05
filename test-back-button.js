const { execSync } = require('child_process');

console.log('Testing BACK button functionality with the Vizio TV API...');

// First, try the command that worked in our testing (numeric code version)
try {
  console.log('\nTesting with KEYLIST format using numeric codes:');
  const result1 = execSync(
    'curl -k -X PUT -H "Content-Type: application/json" -H "AUTH: Zhaylem89u" ' +
    '-d \'{"KEYLIST": [{"CODESET": 4, "CODE": 4, "ACTION": "KEYPRESS"}]}\' ' +
    'https://192.168.50.113:7345/key_command/',
    { encoding: 'utf8' }
  );
  console.log(result1);
  console.log('SUCCESS: Back button command worked with numeric codes!');
} catch (error) {
  console.error('ERROR: The command failed:', error.message);
}

// Test our GraphQL mutation
try {
  console.log('\nTesting through GraphQL API:');
  const result2 = execSync(
    'curl -s "http://localhost:8000/graphql" ' +
    '-H "Content-Type: application/json" ' +
    '-d \'{"query":"mutation { sendTVCommand(command: \\"BACK\\") }"}\' ',
    { encoding: 'utf8' }
  );
  console.log(result2);
  console.log('SUCCESS: GraphQL mutation for BACK button worked!');
} catch (error) {
  console.error('ERROR: The GraphQL request failed:', error.message);
}

console.log('\nTest completed!'); 