// ESM file to test Denon AVR service
import { denonAvrService } from './packages/server/src/services/denonAvrService.js';

async function checkDenonService() {
  console.log('=== Checking Denon AVR Service ===');
  
  try {
    // Initialize the service
    console.log('Initializing Denon AVR service...');
    const initialized = await denonAvrService.init();
    console.log(`Service initialized: ${initialized}`);
    
    if (!initialized) {
      console.error('Failed to initialize Denon AVR service');
      return;
    }
    
    // Wait a moment for all status to be fetched
    console.log('Waiting for status updates...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get current status
    console.log('\nCurrent status:');
    const status = denonAvrService.getStatus();
    console.log(JSON.stringify(status, null, 2));
    
    // Check if power status matches reality
    console.log(`\nPower state detected correctly: ${status.isPoweredOn ? 'YES' : 'NO'}`);
    
    // Force a refresh and check again
    console.log('\nForcing status refresh...');
    await denonAvrService.refreshStatus(false);
    
    // Get updated status
    console.log('\nUpdated status:');
    const updatedStatus = denonAvrService.getStatus();
    console.log(JSON.stringify(updatedStatus, null, 2));
    
  } catch (error) {
    console.error('Error checking Denon AVR service:', error);
  } finally {
    // Clean up
    denonAvrService.stopPolling();
    console.log('\nCheck complete - polling stopped');
    
    // Force exit after a moment to clean up any hanging connections
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run the check
checkDenonService().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 