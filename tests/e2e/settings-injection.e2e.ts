/**
 * E2E tests for settings injection from content script to injected page context
 */

import { launchChromeWithExtension, sleep } from './e2e-utils';

export default async function runSettingsInjectionE2ETests(): Promise<{
  passed: number;
  failed: number;
}> {
  console.log('🧪 Running Settings Injection E2E Tests...');

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

    await page.goto('https://www.youtube.com/watch?v=gGCJOTvECVQ', {
      waitUntil: 'networkidle2',
    });

    await sleep(3000);

    await page.waitForFunction(
      () => {
        const w = window as Window & {
          VSC?: { StorageManager?: unknown };
          VSC_controller?: { initialized?: boolean };
        };
        return !!(w.VSC?.StorageManager && w.VSC_controller?.initialized);
      },
      { timeout: 10000 }
    );

    await runTest('Settings injection should work with user preferences', async () => {
      await page.evaluate(() => {
        const mockSettings = {
          keyBindings: [
            { action: 'slower', key: 83, value: 0.2, force: false, predefined: true },
            { action: 'faster', key: 68, value: 0.2, force: false, predefined: true },
            { action: 'rewind', key: 90, value: 10, force: false, predefined: true },
            { action: 'advance', key: 88, value: 10, force: false, predefined: true },
            { action: 'reset', key: 82, value: 1.9, force: false, predefined: true },
            { action: 'fast', key: 71, value: 1.8, force: false, predefined: true },
            { action: 'display', key: 86, value: 0, force: false, predefined: true },
          ],
          enabled: true,
          lastSpeed: 1.9,
        };

        (window as Window & { VSC_settings?: unknown }).VSC_settings = mockSettings;
      });

      await page.evaluate(() => {
        const w = window as Window & {
          VSC_controller?: { config?: { load: () => Promise<unknown> } };
        };
        if (w.VSC_controller?.config) {
          return w.VSC_controller.config.load();
        }
      });

      await sleep(500);

      const settingsState = await page.evaluate(() => {
        const w = window as Window & {
          VSC?: {
            videoSpeedConfig?: {
              settings?: {
                keyBindings?: Array<{ action: string; value?: number }>;
              };
            };
          };
          VSC_settings?: unknown;
        };
        const config = w.VSC?.videoSpeedConfig;
        const fasterBinding = config?.settings?.keyBindings?.find((kb) => kb.action === 'faster');
        const resetBinding = config?.settings?.keyBindings?.find((kb) => kb.action === 'reset');

        return {
          hasConfig: !!config,
          keyBindingsCount: config?.settings?.keyBindings?.length || 0,
          fasterIncrement: fasterBinding?.value,
          resetPreferredSpeed: resetBinding?.value,
          injectedSettingsAvailable: !!w.VSC_settings,
        };
      });

      if (!settingsState.hasConfig) {
        throw new Error('Extension config not found');
      }

      if (settingsState.fasterIncrement !== 0.2) {
        throw new Error(`Expected faster increment 0.2, got ${settingsState.fasterIncrement}`);
      }

      if (settingsState.resetPreferredSpeed !== 1.9) {
        throw new Error(`Expected reset speed 1.9, got ${settingsState.resetPreferredSpeed}`);
      }
    });

    await runTest('Keyboard shortcuts should use injected settings', async () => {
      await page.focus('video');

      const initialSpeed = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video ? video.playbackRate : null;
      });

      await page.keyboard.press('KeyD');
      await sleep(100);

      const newSpeed = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video ? video.playbackRate : null;
      });

      const speedDifference = Math.round(((newSpeed ?? 0) - (initialSpeed ?? 0)) * 10) / 10;

      if (speedDifference !== 0.2) {
        throw new Error(`Expected speed increment of 0.2, got ${speedDifference}`);
      }
    });

    await runTest('Reset key should use preferred speed', async () => {
      const speedBeforeReset = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video ? video.playbackRate : null;
      });

      await page.keyboard.press('KeyR');
      await sleep(100);

      const resetSpeed = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video ? video.playbackRate : null;
      });

      if (resetSpeed === speedBeforeReset) {
        throw new Error(
          `Reset key should change speed from ${speedBeforeReset}, but it stayed the same`
        );
      }
    });

    await runTest('Settings should persist through extension reload', async () => {
      await page.evaluate(() => {
        const w = window as Window & {
          VSC_controller?: { config?: { load: () => Promise<unknown> } };
        };
        if (w.VSC_controller) {
          return w.VSC_controller.config?.load();
        }
      });

      const reloadedSettings = await page.evaluate(() => {
        const w = window as Window & {
          VSC?: {
            videoSpeedConfig?: {
              settings?: {
                keyBindings?: Array<{ action: string; value?: number }>;
              };
            };
          };
        };
        const config = w.VSC?.videoSpeedConfig;
        const fasterBinding = config?.settings?.keyBindings?.find((kb) => kb.action === 'faster');
        return fasterBinding?.value;
      });

      if (reloadedSettings !== 0.2) {
        throw new Error(
          `Settings not persistent after reload: expected 0.2, got ${reloadedSettings}`
        );
      }
    });
  } catch (error) {
    console.log(`   💥 Test setup failed: ${(error as Error).message}`);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n   📊 Settings Injection E2E Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
