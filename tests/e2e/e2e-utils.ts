/**
 * E2E test utilities for Chrome extension testing
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function launchChromeWithExtension(): Promise<{ browser: Browser; page: Page }> {
  const extensionPath = join(__dirname, '../../dist');

  console.log(`   📁 Loading extension from: ${extensionPath}`);

  try {
    const browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--window-size=1280,720',
        '--allow-file-access-from-files',
      ],
      ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
    });

    console.log('   🌐 Chrome browser launched successfully');

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    await page.setViewport({ width: 1280, height: 720 });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`   🔴 Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error: unknown) => {
      console.log(`   💥 Page Error: ${error instanceof Error ? error.message : String(error)}`);
    });

    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`   🔍 User Agent: ${userAgent}`);

    try {
      await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await sleep(2000);

      const extensionInfo = await page.evaluate(() => {
        const extensions = document.querySelectorAll('extensions-item');
        const extensionNames = Array.from(extensions).map((ext) => {
          const nameEl = ext.shadowRoot?.querySelector('#name');
          return nameEl ? nameEl.textContent : 'Unknown';
        });
        return {
          count: extensions.length,
          names: extensionNames,
        };
      });

      console.log(`   📦 Extensions loaded: ${extensionInfo.count}`);
      if (extensionInfo.names.length > 0) {
        console.log(`   📦 Extension names: ${extensionInfo.names.join(', ')}`);
      }
    } catch {
      console.log('   ⚠️  Could not check extensions page');
    }

    (page as Page & { getConsoleErrors: () => string[] }).getConsoleErrors = () => consoleErrors;

    return { browser, page };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.log(`   ❌ Failed to launch Chrome: ${error.message}`);
    throw error;
  }
}

export async function waitForExtension(page: Page, timeout = 15000): Promise<boolean> {
  try {
    console.log('   🔍 Checking for extension injection...');

    const hasContentScript = await page.evaluate(() => {
      return !!(
        (window as Window & { VSC_controller?: unknown }).VSC_controller ||
        (window as Window & { VSC?: unknown }).VSC ||
        document.querySelector('.vsc-controller') ||
        (document.querySelector('video') as HTMLVideoElement & { vsc?: unknown })?.vsc
      );
    });

    if (hasContentScript) {
      console.log('   ✅ Extension already detected');
      return true;
    }

    await page.waitForFunction(
      () => {
        const hasVSC = !!(window as Window & { VSC?: unknown }).VSC;
        const hasVSCController = !!(window as Window & { VSC_controller?: unknown }).VSC_controller;
        const hasController = !!document.querySelector('.vsc-controller');
        const hasVideoController = !!(
          document.querySelector('video') as HTMLVideoElement & {
            vsc?: unknown;
          }
        )?.vsc;

        return hasVSC || hasVSCController || hasController || hasVideoController;
      },
      { timeout, polling: 1000 }
    );

    console.log('   ✅ Extension detected after waiting');
    return true;
  } catch {
    console.log(`   ⚠️  Extension not detected within ${timeout}ms`);

    const debugInfo = await page.evaluate(() => ({
      hasVideoSpeedExtension: !!(window as Window & { VideoSpeedExtension?: unknown })
        .VideoSpeedExtension,
      hasVideoSpeedExtensionInstance: !!(window as Window & { VSC_controller?: unknown })
        .VSC_controller,
      hasController: !!document.querySelector('.vsc-controller'),
      hasVideoElement: !!document.querySelector('video'),
      videoHasVsc: !!(document.querySelector('video') as HTMLVideoElement & { vsc?: unknown })?.vsc,
      scriptsCount: document.scripts.length,
      extensionId: (window as Window & { chrome?: { runtime?: { id?: string } } }).chrome?.runtime
        ?.id,
    }));

    console.log('   🔍 Debug info:', JSON.stringify(debugInfo, null, 2));
    return false;
  }
}

export async function waitForVideo(
  page: Page,
  selector = 'video',
  timeout = 15000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });

    await page.waitForFunction(
      (sel: string) => {
        const video = document.querySelector(sel) as HTMLVideoElement;
        return video && video.readyState >= 2 && video.duration > 0;
      },
      { timeout },
      selector
    );

    console.log('   📹 Video element found and ready');
    return true;
  } catch {
    console.log(`   ⚠️  Video not ready within ${timeout}ms`);
    return false;
  }
}

export async function waitForController(page: Page, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForSelector('.vsc-controller', { timeout });

    const hasController = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      return (
        controller && controller.shadowRoot && controller.shadowRoot.querySelector('#controller')
      );
    });

    if (hasController) {
      console.log('   🎛️  Video speed controller found');
      return true;
    }
    console.log('   ⚠️  Controller found but shadow DOM not ready');
    return false;
  } catch {
    console.log(`   ⚠️  Video speed controller not found within ${timeout}ms`);
    return false;
  }
}

export async function getVideoSpeed(page: Page, selector = 'video'): Promise<number | null> {
  return await page.evaluate((sel: string) => {
    const video = document.querySelector(sel) as HTMLVideoElement;
    return video ? video.playbackRate : null;
  }, selector);
}

export async function controlVideo(page: Page, action: string): Promise<boolean> {
  try {
    const success = await page.evaluate((actionName: string) => {
      const controller = document.querySelector('.vsc-controller');
      if (!controller || !controller.shadowRoot) {
        return false;
      }

      const button = controller.shadowRoot.querySelector(
        `button[data-action="${actionName}"]`
      ) as HTMLButtonElement | null;
      if (button) {
        button.click();
        return true;
      }
      return false;
    }, action);

    if (success) {
      await sleep(500);
      console.log(`   🔄 Performed action: ${action}`);
      return true;
    }
    console.log(`   ❌ Button not found for action: ${action}`);
    return false;
  } catch {
    console.log(`   ❌ Failed to perform action: ${action}`);
    return false;
  }
}

export async function testKeyboardShortcut(
  page: Page,
  key: Parameters<Page['keyboard']['press']>[0]
): Promise<boolean> {
  try {
    await page.keyboard.press(key);
    await sleep(500);
    console.log(`   ⌨️  Pressed key: ${key}`);
    return true;
  } catch {
    console.log(`   ❌ Failed to press key: ${key}`);
    return false;
  }
}

export async function getControllerSpeedDisplay(page: Page): Promise<string | null> {
  try {
    const speedText = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      if (!controller || !controller.shadowRoot) {
        return null;
      }
      const speedElement = controller.shadowRoot.querySelector('.draggable');
      return speedElement ? speedElement.textContent : null;
    });

    return speedText;
  } catch (error) {
    console.log(`   ⚠️  Could not get controller speed display: ${(error as Error).message}`);
    return null;
  }
}

export async function takeScreenshot(page: Page, filename: string): Promise<void> {
  try {
    const screenshotPath = join(__dirname, `screenshots/${filename}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   📸 Screenshot saved: ${screenshotPath}`);
  } catch (error) {
    console.log(`   ⚠️  Could not save screenshot: ${(error as Error).message}`);
  }
}

export const assert = {
  equal: (actual: unknown, expected: unknown, message?: string): void => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },

  true: (value: unknown, message?: string): void => {
    if (value !== true) {
      throw new Error(message || `Expected true, got ${value}`);
    }
  },

  false: (value: unknown, message?: string): void => {
    if (value !== false) {
      throw new Error(message || `Expected false, got ${value}`);
    }
  },

  exists: (value: unknown, message?: string): void => {
    if (value === null || value === undefined) {
      throw new Error(message || `Expected value to exist, got ${value}`);
    }
  },

  approximately: (actual: number, expected: number, tolerance = 0.1, message?: string): void => {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(message || `Expected ${expected} ± ${tolerance}, got ${actual}`);
    }
  },
};
