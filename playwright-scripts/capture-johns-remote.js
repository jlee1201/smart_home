const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureJohnsRemote() {
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: true // Set to false if you want to see the browser
  });

  try {
    // Create a new page
    const page = await browser.newPage();
    
    // Set viewport size to ensure consistent screenshots
    await page.setViewportSize({ width: 1200, height: 800 });

    // Navigate to the Johns Remote page
    console.log('Navigating to Johns Remote page...');
    await page.goto('http://localhost:3001/johns-remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the remote UI to be fully loaded
    // Wait for the main remote container
    await page.waitForSelector('.bg-slate-900.rounded-3xl', { timeout: 10000 });
    
    // Wait a bit more for any animations to complete
    await page.waitForTimeout(1000);

    // Take a full page screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotsDir, `johns-remote-${timestamp}.png`);
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Also take a focused screenshot of just the volume control area
    const volumeControlElement = await page.$('.flex.items-end.justify-between.gap-4.w-full');
    if (volumeControlElement) {
      const volumeScreenshotPath = path.join(screenshotsDir, `johns-remote-volume-${timestamp}.png`);
      await volumeControlElement.screenshot({
        path: volumeScreenshotPath
      });
      console.log(`Volume control screenshot saved to: ${volumeScreenshotPath}`);
    }

    // Log some information about the volume bars
    const volumeBars = await page.$$eval('.flex.items-end.justify-between.h-10.flex-1.px-1 > div', bars => {
      return {
        count: bars.length,
        widths: bars.map(bar => bar.style.width),
        heights: bars.map(bar => bar.style.height)
      };
    });
    
    console.log('Volume bar information:', volumeBars);

  } catch (error) {
    console.error('Error capturing screenshot:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the script
captureJohnsRemote().catch(console.error);