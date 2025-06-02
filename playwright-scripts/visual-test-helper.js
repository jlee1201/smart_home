const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class VisualTestHelper {
  constructor() {
    this.screenshotsDir = path.join(__dirname, 'screenshots');
    this.browser = null;
    this.page = null;
  }

  async init() {
    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1200, height: 800 });
  }

  async navigateToJohnsRemote() {
    console.log('Navigating to Johns Remote page...');
    await this.page.goto('http://localhost:3001/johns-remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the remote UI to be fully loaded
    await this.page.waitForSelector('.bg-slate-900.rounded-3xl', { timeout: 10000 });
    await this.page.waitForTimeout(1000); // Wait for animations
  }

  async captureVolumeControl(suffix = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `volume-control${suffix ? '-' + suffix : ''}-${timestamp}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    // Find the volume control container - the div containing the volume bars
    const volumeControl = await this.page.$('.flex.items-end.justify-between.h-10.px-1');
    
    if (!volumeControl) {
      console.error('Volume control element not found!');
      return null;
    }

    // Take screenshot
    await volumeControl.screenshot({ path: filepath });
    console.log(`Volume control screenshot saved to: ${filepath}`);

    // Get volume bar details
    const volumeBarInfo = await this.page.evaluate(() => {
      const container = document.querySelector('.flex.items-end.justify-between.h-10.px-1');
      if (!container) return null;

      const bars = Array.from(container.querySelectorAll('div[style]'));
      const containerRect = container.getBoundingClientRect();

      return {
        container: {
          width: containerRect.width,
          height: containerRect.height
        },
        bars: {
          count: bars.length,
          details: bars.map((bar, index) => ({
            index,
            width: bar.style.width,
            height: bar.style.height,
            backgroundColor: bar.style.backgroundColor,
            opacity: bar.style.opacity
          }))
        }
      };
    });

    console.log('Volume bar analysis:', JSON.stringify(volumeBarInfo, null, 2));
    
    return { filepath, info: volumeBarInfo };
  }

  async captureFullRemote(suffix = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `johns-remote-full${suffix ? '-' + suffix : ''}-${timestamp}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    await this.page.screenshot({
      path: filepath,
      fullPage: true
    });

    console.log(`Full screenshot saved to: ${filepath}`);
    return filepath;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async captureBeforeAfter(beforeFn, afterFn) {
    try {
      await this.init();
      await this.navigateToJohnsRemote();

      // Capture "before" state
      console.log('\n=== Capturing BEFORE state ===');
      const before = await this.captureVolumeControl('before');
      
      if (beforeFn) {
        console.log('\n=== Executing changes ===');
        await beforeFn(this.page);
        await this.page.waitForTimeout(2000); // Wait for changes to apply
      }

      // Capture "after" state
      console.log('\n=== Capturing AFTER state ===');
      const after = await this.captureVolumeControl('after');

      // Compare results
      if (before?.info && after?.info) {
        console.log('\n=== Comparison ===');
        console.log(`Bar count: ${before.info.bars.count} -> ${after.info.bars.count}`);
        console.log(`Container width: ${before.info.container.width}px -> ${after.info.container.width}px`);
      }

    } finally {
      await this.cleanup();
    }
  }
}

// Example usage:
async function runVisualTest() {
  const helper = new VisualTestHelper();
  
  try {
    await helper.init();
    await helper.navigateToJohnsRemote();
    
    // Capture current state
    await helper.captureVolumeControl('current');
    await helper.captureFullRemote('current');
    
  } finally {
    await helper.cleanup();
  }
}

// Export for use in other scripts
module.exports = VisualTestHelper;

// Run if called directly
if (require.main === module) {
  runVisualTest().catch(console.error);
}