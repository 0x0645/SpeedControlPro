/**
 * YouTube E2E tests for Video Speed Controller extension
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

const YOUTUBE_TEST_URL = 'https://www.youtube.com/watch?v=gGCJOTvECVQ';

export default async function runYouTubeE2ETests(): Promise<{
  passed: number;
  failed: number;
}> {
  console.log('🎭 Running YouTube E2E Tests...\n');

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

    await runTest('Extension should load on YouTube', async () => {
      console.log(`   🌐 Navigating to: ${YOUTUBE_TEST_URL}`);
      await page.goto(YOUTUBE_TEST_URL, { waitUntil: 'networkidle2' });

      const extensionLoaded = await waitForExtension(page, 5000);
      assert.true(extensionLoaded, 'Extension should be loaded on YouTube');
    });

    await runTest('YouTube video should be detected', async () => {
      const videoReady = await waitForVideo(page, 'video.html5-main-video', 15000);
      assert.true(videoReady, 'YouTube video should be ready');
    });

    await runTest('Speed controller should appear on YouTube video', async () => {
      const controllerFound = await waitForController(page, 15000);
      assert.true(controllerFound, 'Speed controller should appear on YouTube');
    });

    await runTest('YouTube video should start at normal speed', async () => {
      const speed = await getVideoSpeed(page, 'video.html5-main-video');
      assert.equal(speed, 1, 'YouTube video should start at 1.0x speed');
    });

    await runTest('Extension controller should work on YouTube', async () => {
      const initialSpeed = await getVideoSpeed(page, 'video.html5-main-video');
      const success = await controlVideo(page, 'faster');
      assert.true(success, 'Faster button should work on YouTube');

      const newSpeed = await getVideoSpeed(page, 'video.html5-main-video');
      assert.true(
        initialSpeed !== null && newSpeed !== null && newSpeed > initialSpeed,
        'Speed should increase on YouTube'
      );

      console.log(`   📊 Speed changed from ${initialSpeed} to ${newSpeed}`);
    });

    await runTest('YouTube native speed controls should be overridden', async () => {
      await controlVideo(page, 'faster');
      await controlVideo(page, 'faster');
      const extensionSpeed = await getVideoSpeed(page, 'video.html5-main-video');

      assert.true(
        extensionSpeed !== null && extensionSpeed > 1.0,
        'Extension should control YouTube video speed'
      );

      const speedDisplay = await getControllerSpeedDisplay(page);
      assert.exists(speedDisplay, 'Speed display should show current speed');
    });

    await runTest('Keyboard shortcuts should work on YouTube', async () => {
      await testKeyboardShortcut(page, 'KeyR');
      await sleep(1000);

      const initialSpeed = await getVideoSpeed(page, 'video.html5-main-video');

      await testKeyboardShortcut(page, 'KeyD');
      const fasterSpeed = await getVideoSpeed(page, 'video.html5-main-video');
      assert.true(
        initialSpeed !== null && fasterSpeed !== null && fasterSpeed > initialSpeed,
        'D key should work on YouTube'
      );

      await testKeyboardShortcut(page, 'KeyS');
      const slowerSpeed = await getVideoSpeed(page, 'video.html5-main-video');
      assert.true(
        fasterSpeed !== null && slowerSpeed !== null && slowerSpeed < fasterSpeed,
        'S key should work on YouTube'
      );

      console.log(
        `   ⌨️  Keyboard shortcuts working: ${initialSpeed} → ${fasterSpeed} → ${slowerSpeed}`
      );
    });

    await runTest('Extension should handle YouTube player interactions', async () => {
      await page.click('video.html5-main-video');
      await sleep(1000);

      const speedBeforePause = await getVideoSpeed(page, 'video.html5-main-video');

      await page.click('video.html5-main-video');
      await sleep(1000);

      const speedAfterPlay = await getVideoSpeed(page, 'video.html5-main-video');
      assert.equal(
        speedBeforePause,
        speedAfterPlay,
        'Speed should be maintained across play/pause'
      );
    });

    await runTest('Extension should handle YouTube page navigation', async () => {
      const currentSpeed = await getVideoSpeed(page, 'video.html5-main-video');

      await page.evaluate(() => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
        if (video && video.duration > 30) {
          video.currentTime = 30;
        }
      });

      await sleep(2000);

      const speedAfterSeek = await getVideoSpeed(page, 'video.html5-main-video');
      assert.equal(currentSpeed, speedAfterSeek, 'Speed should be maintained after seeking');
    });

    await runTest('Multiple speed changes should work correctly', async () => {
      await page.evaluate(() => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
        if (video) {
          video.playbackRate = 1.0;
        }
      });
      await sleep(200);

      const baseSpeed = await getVideoSpeed(page, 'video.html5-main-video');
      console.log(`   🔍 Speed after baseline reset: ${baseSpeed}`);

      await controlVideo(page, 'faster');
      const speed1 = await getVideoSpeed(page, 'video.html5-main-video');
      console.log(`   🔍 Speed after 1st faster: ${speed1}`);

      await controlVideo(page, 'faster');
      const speed2 = await getVideoSpeed(page, 'video.html5-main-video');
      console.log(`   🔍 Speed after 2nd faster: ${speed2}`);

      await controlVideo(page, 'faster');
      const finalSpeed = await getVideoSpeed(page, 'video.html5-main-video');
      console.log(`   🔍 Final speed after 3rd faster: ${finalSpeed}`);

      assert.true(
        finalSpeed !== null && finalSpeed > 1.25,
        `Multiple speed increases should accumulate (expected > 1.25, got ${finalSpeed})`
      );
      assert.true(
        finalSpeed !== null && finalSpeed < 1.35,
        `Speed should not increase too much (expected < 1.35, got ${finalSpeed})`
      );

      console.log(`   🔄 Final speed after multiple changes: ${finalSpeed}`);
    });

    await takeScreenshot(page, 'youtube-test-controller.png');

    await runTest('Rewind and advance controls should work', async () => {
      const currentTime = await page.evaluate(() => {
        const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
        return video ? video.currentTime : null;
      });

      if (currentTime !== null && currentTime > 15) {
        await controlVideo(page, 'rewind');
        await sleep(1000);

        const newTime = await page.evaluate(() => {
          const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
          return video ? video.currentTime : null;
        });

        assert.true(newTime !== null && newTime < currentTime, 'Rewind should move video backward');

        await controlVideo(page, 'advance');
        await sleep(1000);

        const advancedTime = await page.evaluate(() => {
          const video = document.querySelector('video.html5-main-video') as HTMLVideoElement;
          return video ? video.currentTime : null;
        });

        assert.true(
          advancedTime !== null && newTime !== null && advancedTime > newTime,
          'Advance should move video forward'
        );
      }
    });

    await takeScreenshot(page, 'youtube-test-final.png');
  } catch (error) {
    console.log(`   💥 Test setup failed: ${(error as Error).message}`);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n   📊 YouTube E2E Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
