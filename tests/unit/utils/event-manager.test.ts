/**
 * Unit tests for EventManager class
 * Tests cooldown behavior to prevent rapid changes
 */

import { describe, it, expect } from 'vitest';
import { createMockVideo } from '../../helpers/test-utils';
import { loadCoreModules } from '../../helpers/module-loader';

// Load all required modules
await loadCoreModules();

describe('EventManager', () => {
  it('should initialize with cooldown disabled', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);

    expect(eventManager.coolDown).toBe(false);
  });

  it('refreshCoolDown should activate cooldown period', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);

    // Cooldown should start as false
    expect(eventManager.coolDown).toBe(false);

    // Activate cooldown
    eventManager.refreshCoolDown();

    // Cooldown should now be active (a timeout object)
    expect(eventManager.coolDown !== false).toBe(true);
  });

  it('handleRateChange should block events during cooldown', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockVideo.vsc = { speedIndicator: { textContent: '1.00' } };

    // Create mock event that looks like our synthetic ratechange event
    let eventStopped = false;
    const mockEvent = {
      composedPath: () => [mockVideo],
      target: mockVideo,
      detail: { origin: 'external' }, // Not our own event
      stopImmediatePropagation: () => {
        eventStopped = true;
      },
    };

    // Activate cooldown first
    eventManager.refreshCoolDown();

    // Event should be blocked by cooldown
    eventManager.handleRateChange(mockEvent);
    expect(eventStopped).toBe(true);
  });

  it('cooldown should expire after timeout', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);

    // Activate cooldown
    eventManager.refreshCoolDown();
    expect(eventManager.coolDown !== false).toBe(true);

    // Wait for cooldown to expire (COOLDOWN_MS + buffer)
    const waitMs = (window.VSC.EventManager?.COOLDOWN_MS || 50) + 50;
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Cooldown should be expired
    expect(eventManager.coolDown).toBe(false);
  });

  it('multiple refreshCoolDown calls should reset timer', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);

    // First cooldown activation
    eventManager.refreshCoolDown();
    const firstTimeout = eventManager.coolDown;
    expect(firstTimeout !== false).toBe(true);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second cooldown activation should replace the first
    eventManager.refreshCoolDown();
    const secondTimeout = eventManager.coolDown;

    // Should be a different timeout object
    expect(secondTimeout !== firstTimeout).toBe(true);
    expect(secondTimeout !== false).toBe(true);
  });

  it('cleanup should clear cooldown', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);

    // Activate cooldown
    eventManager.refreshCoolDown();
    expect(eventManager.coolDown !== false).toBe(true);

    // Cleanup should clear the cooldown
    eventManager.cleanup();
    expect(eventManager.coolDown).toBe(false);
  });
});
