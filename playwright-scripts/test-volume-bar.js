const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testVolumeBar() {
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();
  
  await page.setViewportSize({ width: 1200, height: 800 });
  
  console.log('Navigating to Johns Remote page...');
  await page.goto('http://localhost:3001/johns-remote', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Wait for the remote to load
  await page.waitForSelector('.bg-slate-900.rounded-3xl', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Get the entire volume control section (including buttons)
  const volumeSection = await page.$('.flex.items-end.justify-between.gap-4.w-full');
  
  if (volumeSection) {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await volumeSection.screenshot({
      path: path.join(screenshotsDir, `volume-section-${timestamp}.png`)
    });
    
    console.log('Volume section screenshot saved');
    
    // Get measurements
    const measurements = await page.evaluate(() => {
      const section = document.querySelector('.flex.items-end.justify-between.gap-4.w-full');
      const volumeBar = document.querySelector('.flex.items-end.justify-between.h-10.px-1');
      const leftButton = section.querySelector('button:first-child');
      const rightButton = section.querySelector('button:last-child');
      
      return {
        section: section ? section.getBoundingClientRect() : null,
        volumeBar: volumeBar ? volumeBar.getBoundingClientRect() : null,
        leftButton: leftButton ? leftButton.getBoundingClientRect() : null,
        rightButton: rightButton ? rightButton.getBoundingClientRect() : null,
        computedStyles: volumeBar ? {
          width: window.getComputedStyle(volumeBar).width,
          flex: window.getComputedStyle(volumeBar).flex,
          flexGrow: window.getComputedStyle(volumeBar).flexGrow,
          flexShrink: window.getComputedStyle(volumeBar).flexShrink,
          flexBasis: window.getComputedStyle(volumeBar).flexBasis
        } : null
      };
    });
    
    console.log('Measurements:', JSON.stringify(measurements, null, 2));
  }
  
  // Keep browser open for 5 seconds so you can see it
  await page.waitForTimeout(5000);
  
  await browser.close();
}

testVolumeBar().catch(console.error);