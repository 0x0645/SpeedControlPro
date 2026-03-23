/**
 * Basic E2E tests for Video Speed Controller extension
 */

import {
  launchChromeWithExtension,
  waitForExtension,
  waitForVideo,
  waitForController,
  getVideoSpeed,
  controlVideo,
  testKeyboardShortcut,
  getControllerSpeedDisplay,
  takeScreenshot,
  assert,
  sleep,
} from './e2e-utils';

export default async function runBasicE2ETests(): Promise<{ passed: number; failed: number }> {
  console.log('🎭 Running Basic E2E Tests...\n');

  let browser: Awaited<ReturnType<typeof launchChromeWithExtension>>['browser'] | undefined;
  let passed = 0;
  let failed = 0;

  const runTest = async (testName: string, testFn: () => Promise<void>): Promise<void> => {
    try {
      console.log(`   🧪 ${testName}`);
      await testFn();
      console.log(`   ✅ ${testName}`);
      passed++;
    } catch (error) {
      console.log(`   ❌ ${testName}: ${(error as Error).message}`);
      failed++;
    }
  };

  try {
    const { browser: chromeBrowser, page } = await launchChromeWithExtension();
    browser = chromeBrowser;

    await runTest('Extension should load in Chrome', async () => {
      const testPagePath = `file://${process.cwd()}/tests/e2e/test-video.html`;
      await page.goto(testPagePath, { waitUntil: 'domcontentloaded' });
      await sleep(3000);

      const extensionLoaded = await waitForExtension(page, 8000);
      assert.true(extensionLoaded, 'Extension should be loaded');
    });

    await runTest('Video element should be detected', async () => {
      const videoReady = await waitForVideo(page, 'video', 10000);
      assert.true(videoReady, 'Video should be ready');
    });

    await runTest('Speed controller should appear on video', async () => {
      const controllerFound = await waitForController(page, 10000);
      assert.true(controllerFound, 'Speed controller should appear');
    });

    await runTest('Initial video speed should be 1.0x', async () => {
      const speed = await getVideoSpeed(page);
      assert.equal(speed, 1, 'Initial speed should be 1.0x');
    });

    await runTest('Controller should display initial speed', async () => {
      const speedDisplay = await getControllerSpeedDisplay(page);
      assert.exists(speedDisplay, 'Speed display should exist');
      assert.true(speedDisplay && speedDisplay.includes('1.'), 'Speed display should show 1.x');
    });

    await runTest('Faster button should increase speed', async () => {
      const initialSpeed = await getVideoSpeed(page);
      const success = await controlVideo(page, 'faster');
      assert.true(success, 'Faster button should work');

      const newSpeed = await getVideoSpeed(page);
      assert.true(
        initialSpeed !== null && newSpeed !== null && newSpeed > initialSpeed,
        'Speed should increase'
      );
    });

    await runTest('Slower button should decrease speed', async () => {
      const initialSpeed = await getVideoSpeed(page);
      const success = await controlVideo(page, 'slower');
      assert.true(success, 'Slower button should work');

      const newSpeed = await getVideoSpeed(page);
      assert.true(
        initialSpeed !== null && newSpeed !== null && newSpeed < initialSpeed,
        'Speed should decrease'
      );
    });

    await runTest('Reset key should restore normal speed', async () => {
      await controlVideo(page, 'faster');
      await controlVideo(page, 'faster');

      await testKeyboardShortcut(page, 'KeyR');
      await sleep(500);

      const speed = await getVideoSpeed(page);
      assert.approximately(speed ?? 0, 1.0, 0.1, 'Speed should be approximately 1.0 after reset');
    });

    await runTest('Keyboard shortcuts should work', async () => {
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.playbackRate = 1.0;
        }

        const w = window as Window & {
          VSC_controller?: { config?: { setKeyBinding: (a: string, v: number) => void } };
        };
        if (w.VSC_controller?.config) {
          w.VSC_controller.config.setKeyBinding('reset', 1.0);
        }
      });
      await sleep(200);

      const initialSpeed = await getVideoSpeed(page);
      console.log(`   🔍 Initial speed: ${initialSpeed}`);
      await testKeyboardShortcut(page, 'KeyD');

      const newSpeed = await getVideoSpeed(page);
      console.log(`   🔍 Speed after D key: ${newSpeed}`);
      assert.true(
        initialSpeed !== null && newSpeed !== null && newSpeed > initialSpeed,
        'D key should increase speed'
      );

      await testKeyboardShortcut(page, 'KeyS');
      const slowerSpeed = await getVideoSpeed(page);
      console.log(`   🔍 Speed after S key: ${slowerSpeed}`);
      assert.true(
        newSpeed !== null && slowerSpeed !== null && slowerSpeed < newSpeed,
        'S key should decrease speed'
      );

      const speedBeforeReset = await getVideoSpeed(page);
      await testKeyboardShortcut(page, 'KeyR');
      await sleep(200);
      const resetSpeed = await getVideoSpeed(page);
      console.log(`   🔍 Speed before R key: ${speedBeforeReset}, after R key: ${resetSpeed}`);
      assert.true(
        speedBeforeReset !== resetSpeed,
        `R key should change speed from ${speedBeforeReset}, got ${resetSpeed}`
      );
    });

    await takeScreenshot(page, 'basic-test-final.png');
  } catch (error) {
    console.log(`   💥 Test setup failed: ${(error as Error).message}`);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n   📊 Basic E2E Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
