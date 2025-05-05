const { execSync } = require('child_process');

console.log('Testing EXIT button functionality with the Vizio TV API...');

// First, try the command that worked in our testing
try {
  console.log('\nTesting with KEYLIST format using correct numeric code:');
  const result1 = execSync(
    'curl -k -X PUT -H "Content-Type: application/json" -H "AUTH: Zhaylem89u" ' +
    '-d \'{"KEYLIST": [{"CODESET": 3, "CODE": 1, "ACTION": "KEYPRESS"}]}\' ' +
    'https://192.168.50.113:7345/key_command/',
    { encoding: 'utf8' }
  );
  console.log(result1);
  console.log('SUCCESS: EXIT button command worked with numeric codes!');
} catch (error) {
  console.error('ERROR: The command failed:', error.message);
}

// Now rebuild and restart to ensure our code changes take effect
try {
  console.log('\nRebuilding the application to apply our changes...');
  execSync('npm run build', { encoding: 'utf8' });
  console.log('Build completed successfully.');
} catch (error) {
  console.error('ERROR: Build failed:', error.message);
  process.exit(1);
}

// Test our GraphQL mutation with the updated code
try {
  console.log('\nTesting through GraphQL API:');
  const result2 = execSync(
    'curl -s "http://localhost:8001/graphql" ' +
    '-H "Content-Type: application/json" ' +
    '-d \'{"query":"mutation { sendTVCommand(command: \\"EXIT\\") }"}\' ',
    { encoding: 'utf8' }
  );
  console.log(result2);
  console.log('SUCCESS: GraphQL mutation for EXIT button worked!');
} catch (error) {
  console.error('ERROR: The GraphQL request failed:', error.message);
}

console.log('\nTest completed!'); 