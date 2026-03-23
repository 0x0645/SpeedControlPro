/**
 * E2E test for display toggle functionality
 */

import { launchChromeWithExtension, sleep } from './e2e-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDisplayToggle(): Promise<{ success: true } | { success: false; error: string }> {
  console.log('🧪 Testing display toggle functionality...');

  const { browser, page } = await launchChromeWithExtension();

  try {
    const testPagePath = `file://${path.join(__dirname, 'test-video.html')}`;
    await page.goto(testPagePath, { waitUntil: 'domcontentloaded' });

    await sleep(2000);

    const controllerVisible = await page.evaluate(() => {
      const controllers = document.querySelectorAll('.vsc-controller');
      if (controllers.length === 0) {
        return { success: false, message: 'No controller found' };
      }

      const controller = controllers[0];
      const computedStyle = window.getComputedStyle(controller);
      const isVisible =
        computedStyle.display !== 'none' &&
        computedStyle.visibility !== 'hidden' &&
        !controller.classList.contains('vsc-hidden');

      return {
        success: isVisible,
        message: `Controller initial state - Classes: ${controller.className}, Display: ${computedStyle.display}, Visibility: ${computedStyle.visibility}`,
      };
    });

    if (!controllerVisible.success) {
      throw new Error(`Controller not initially visible: ${controllerVisible.message}`);
    }

    console.log('✅ Controller is initially visible');

    await page.keyboard.press('v');
    await sleep(500);

    const controllerHidden = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      if (!controller) {
        return { success: false, message: 'No controller' };
      }
      const computedStyle = window.getComputedStyle(controller);
      const isHidden =
        computedStyle.display === 'none' ||
        computedStyle.visibility === 'hidden' ||
        controller.classList.contains('vsc-hidden');

      return {
        success: isHidden,
        message: `After first toggle - Classes: ${controller.className}, Display: ${computedStyle.display}, Visibility: ${computedStyle.visibility}`,
      };
    });

    if (!controllerHidden.success) {
      throw new Error(`Controller not hidden after first toggle: ${controllerHidden.message}`);
    }

    console.log('✅ Controller hidden after pressing V');

    await page.keyboard.press('v');
    await sleep(500);

    const controllerVisibleAgain = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      if (!controller) {
        return { success: false, message: 'No controller' };
      }
      const computedStyle = window.getComputedStyle(controller);
      const isVisible =
        computedStyle.display !== 'none' &&
        computedStyle.visibility !== 'hidden' &&
        !controller.classList.contains('vsc-hidden');

      return {
        success: isVisible,
        message: `After second toggle - Classes: ${controller.className}, Display: ${computedStyle.display}, Visibility: ${computedStyle.visibility}`,
      };
    });

    if (!controllerVisibleAgain.success) {
      throw new Error(
        `Controller not visible after second toggle: ${controllerVisibleAgain.message}`
      );
    }

    console.log('✅ Controller visible again after pressing V');

    const consoleLogs = await page.evaluate(() => {
      const logs: string[] = [];
      const originalLog = console.log;
      (console as Console & { log: (...args: unknown[]) => void }).log = (...args: unknown[]) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };

      const event = new KeyboardEvent('keydown', { keyCode: 86 });
      document.dispatchEvent(event);

      return logs;
    });

    console.log('📋 Console logs:', consoleLogs);

    console.log('✅ Display toggle test passed!');
    return { success: true };
  } catch (error) {
    console.error('❌ Display toggle test failed:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  } finally {
    await browser.close();
  }
}

export async function run(): Promise<{ passed: number; failed: number }> {
  const result = await testDisplayToggle();
  return {
    passed: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
  };
}

export { testDisplayToggle };
