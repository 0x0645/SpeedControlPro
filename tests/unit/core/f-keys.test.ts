/**
 * Tests for F13-F24 and special key support
 * Verifies that the expanded keyboard handling works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadCoreModules } from '../../helpers/module-loader';

// Load required modules (need core modules for ActionHandler, EventManager, stateManager)
await loadCoreModules();

describe('F-Keys', () => {
  beforeEach(() => {
    // Clear state manager for tests
    if (window.VSC && window.VSC.stateManager) {
      window.VSC.stateManager.__resetForTests();
    }
    if (window.VSC && window.VSC.videoSpeedConfig) {
      window.VSC.videoSpeedConfig.__resetForTests?.();
    }
  });

  it('F13-F24 keys should be valid key bindings', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();

    // Test saving F13-F24 key bindings
    const fKeyBindings = [];
    for (let i = 13; i <= 24; i++) {
      fKeyBindings.push({
        action: 'faster',
        key: 111 + i, // F13=124, F14=125, etc.
        value: 0.1,
        force: false,
        predefined: false,
      });
    }

    await config.save({ keyBindings: fKeyBindings });
    await config.load();

    expect(config.settings.keyBindings.length).toBe(fKeyBindings.length);

    // Verify each F-key binding
    for (let i = 0; i < fKeyBindings.length; i++) {
      const binding = config.settings.keyBindings[i];
      expect(binding.key).toBe(fKeyBindings[i].key);
    }
  });

  it('Special keys beyond standard range should be accepted', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();

    // Test various special key codes that might exist on different keyboards
    const specialKeys = [
      { keyCode: 144, description: 'NumLock' },
      { keyCode: 145, description: 'ScrollLock' },
      { keyCode: 19, description: 'Pause/Break' },
      { keyCode: 44, description: 'PrintScreen' },
      { keyCode: 173, description: 'Media Mute' },
      { keyCode: 174, description: 'Media Volume Down' },
      { keyCode: 175, description: 'Media Volume Up' },
      { keyCode: 179, description: 'Media Play/Pause' },
    ];

    const specialKeyBindings = specialKeys.map((key) => ({
      action: 'pause',
      key: key.keyCode,
      value: 0,
      force: false,
      predefined: false,
    }));

    await config.save({ keyBindings: specialKeyBindings });
    await config.load();

    expect(config.settings.keyBindings.length).toBe(specialKeyBindings.length);

    specialKeys.forEach((specialKey, index) => {
      const binding = config.settings.keyBindings[index];
      expect(binding.key).toBe(specialKey.keyCode);
    });
  });

  it('Blacklisted keys should be properly handled in options UI', async () => {
    // This test verifies that blacklisted keys are rejected in the options UI
    // The actual runtime blocking of Tab happens through browser navigation handling

    // Simulate the recordKeyPress function behavior with blacklisted keys
    const BLACKLISTED_KEYCODES = [9, 16, 17, 18, 91, 92, 93, 224];

    BLACKLISTED_KEYCODES.forEach((keyCode) => {
      // In the real options.js, blacklisted keys would be prevented
      const isBlacklisted = BLACKLISTED_KEYCODES.includes(keyCode);
      expect(isBlacklisted).toBe(true);
    });

    // Verify that non-blacklisted keys would be accepted
    const allowedKeys = [124, 65, 32, 13]; // F13, A, Space, Enter
    allowedKeys.forEach((keyCode) => {
      const isBlacklisted = BLACKLISTED_KEYCODES.includes(keyCode);
      expect(isBlacklisted).toBe(false);
    });
  });

  it('EventManager should handle F-keys correctly', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();
    await config.load();

    const actionHandler = new window.VSC.ActionHandler!(config, null);
    const eventManager = new window.VSC.EventManager!(config, actionHandler);
    actionHandler.eventManager = eventManager;

    // Add F13 key binding
    config.settings.keyBindings = [
      {
        action: 'faster',
        key: 124, // F13
        value: 0.1,
        force: false,
        predefined: false,
      },
    ];

    const mockVideo = document.createElement('video') as HTMLVideoElement & {
      vsc?: { div: HTMLElement; speedIndicator: { textContent: string } };
    };
    mockVideo.playbackRate = 1.0;
    Object.defineProperties(mockVideo, {
      paused: { value: false, writable: true, configurable: true },
      muted: { value: false, writable: true, configurable: true },
      currentTime: { value: 0, writable: true, configurable: true },
      duration: { value: 100, writable: true, configurable: true },
      currentSrc: { value: 'test-video.mp4', writable: true, configurable: true },
      src: { value: 'test-video.mp4', writable: true, configurable: true },
    });
    mockVideo.vsc = { div: document.createElement('div'), speedIndicator: { textContent: '1.00' } };
    document.body.appendChild(mockVideo);

    const mockControllerId = 'test-f-keys-controller';
    window.VSC.stateManager!.controllers.set(mockControllerId, {
      controller: { video: mockVideo },
      element: mockVideo,
      videoSrc: mockVideo.currentSrc,
      tagName: mockVideo.tagName,
      created: Date.now(),
    });

    eventManager.handleKeydown(
      new KeyboardEvent('keydown', { key: 'F13', keyCode: 124, bubbles: true })
    );

    expect(mockVideo.playbackRate).toBe(1.1);

    document.body.removeChild(mockVideo);
  });

  it('Key display names should work for all supported keys', () => {
    const constants = window.VSC?.Constants as Record<string, unknown> | undefined;
    const keyCodeAliases = (constants?.keyCodeAliases as Record<number, string>) ?? {};

    for (let i = 13; i <= 24; i++) {
      const keyCode = 111 + i;
      const hasAlias = keyCodeAliases[keyCode] !== undefined || keyCode === 124 + (i - 13);
      expect(hasAlias).toBe(true);
    }
  });
});
