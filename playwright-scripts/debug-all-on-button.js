const { chromium } = require('playwright');

async function debugAllOnButton() {
  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Show browser so we can see what's happening
  });

  try {
    // Create a new page
    const page = await browser.newPage();

    // Set viewport size
    await page.setViewportSize({ width: 1200, height: 800 });

    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({
        type: msg.type(),
        text: text,
        timestamp: new Date().toISOString(),
      });
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    });

    // Capture network errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Navigate to the Johns Remote page
    console.log('Navigating to Johns Remote page...');
    await page.goto('http://localhost:3000/johns-remote', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for the remote UI to be fully loaded
    console.log('Waiting for remote UI to load...');
    await page.waitForSelector('.bg-slate-900.rounded-3xl', { timeout: 15000 });

    // Wait a bit more for GraphQL queries to complete
    await page.waitForTimeout(3000);

    // Check the All On button state
    console.log('\n=== ALL ON BUTTON DEBUG ===');

    const allOnButton = await page.$('button:has-text("All On")');
    if (allOnButton) {
      const isDisabled = await allOnButton.getAttribute('disabled');
      const className = await allOnButton.getAttribute('class');
      const title = await allOnButton.getAttribute('title');

      console.log('All On Button Status:');
      console.log('- Disabled:', isDisabled !== null);
      console.log('- Class:', className);
      console.log('- Title:', title);
      console.log('- Has gray background:', className?.includes('bg-gray-500') || false);
    } else {
      console.log('All On button not found!');
    }

    // Check the status display
    console.log('\n=== STATUS DISPLAY ===');
    const statusDisplay = await page.$('.bg-slate-300.rounded-lg');
    if (statusDisplay) {
      const statusText = await statusDisplay.textContent();
      console.log('Status Display Text:', statusText);
    }

    // Look for specific debug logs
    console.log('\n=== CONSOLE LOGS ANALYSIS ===');
    const debugLogs = consoleLogs.filter(log => log.text.includes('All On Debug'));
    if (debugLogs.length > 0) {
      console.log('Found All On Debug logs:');
      debugLogs.forEach(log => {
        console.log(`  ${log.timestamp}: ${log.text}`);
      });
    } else {
      console.log('No "All On Debug" logs found');
    }

    // Check for any error logs
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    if (errorLogs.length > 0) {
      console.log('\nError logs found:');
      errorLogs.forEach(log => {
        console.log(`  ${log.timestamp}: ${log.text}`);
      });
    }

    // Check for GraphQL errors
    const graphqlErrors = consoleLogs.filter(
      log =>
        log.text.includes('GraphQL') ||
        log.text.includes('Error fetching') ||
        log.text.includes('subscription error')
    );
    if (graphqlErrors.length > 0) {
      console.log('\nGraphQL-related logs:');
      graphqlErrors.forEach(log => {
        console.log(`  [${log.type}] ${log.timestamp}: ${log.text}`);
      });
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total console logs captured: ${consoleLogs.length}`);
    console.log(`Debug logs: ${debugLogs.length}`);
    console.log(`Error logs: ${errorLogs.length}`);
    console.log(`GraphQL logs: ${graphqlErrors.length}`);

    // Wait a moment before closing
    await page.waitForTimeout(2000);
  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the script
debugAllOnButton().catch(console.error);
