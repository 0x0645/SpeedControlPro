/**
 * Unit tests for ActionHandler class
 * Using global variables to match browser extension architecture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockVideo,
  createMockDOM,
  type MockDOM,
  type MockVideoOptions,
} from '../../helpers/test-utils';
import { loadCoreModules } from '../../helpers/module-loader';
import type { IVideoSpeedConfig, IActionHandler } from '../../../src/types/settings';

// Load all required modules
await loadCoreModules();

let mockDOM: MockDOM | undefined;

function createTestVideoWithController(
  config: IVideoSpeedConfig,
  actionHandler: IActionHandler,
  videoOptions: MockVideoOptions = {}
) {
  const mockVideo = createMockVideo(videoOptions);

  if (!mockVideo.parentElement) {
    const parentDiv = document.createElement('div');
    document.body.appendChild(parentDiv);
    parentDiv.appendChild(mockVideo);
  }

  const initialPlaybackRate = mockVideo.playbackRate;

  new window.VSC.VideoController!(mockVideo, mockVideo.parentElement, config, actionHandler);

  // Restore initial playback rate for test consistency
  mockVideo.playbackRate = initialPlaybackRate;

  return mockVideo;
}

describe('ActionHandler', () => {
  beforeEach(() => {
    mockDOM = createMockDOM();

    // Clear state manager for tests
    if (window.VSC?.stateManager) {
      window.VSC.stateManager.__resetForTests?.();
    }

    // Initialize site handler manager for tests
    if (window.VSC && window.VSC.siteHandlerManager) {
      window.VSC.siteHandlerManager.initialize(document);
    }
  });

  afterEach(() => {
    if (mockDOM) {
      mockDOM.cleanup();
    }
  });

  it('ActionHandler should set video speed', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true;

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler);

    actionHandler.adjustSpeed(mockVideo, 2.0);

    expect(mockVideo.playbackRate).toBe(2.0);
    expect(mockVideo.vsc!.speedIndicator!.textContent).toBe('2.00');
    expect(config.settings.lastSpeed).toBe(2.0);
  });

  it('ActionHandler should handle faster action', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { playbackRate: 1.0 });

    actionHandler.runAction('faster', 0.1);

    expect(mockVideo.playbackRate).toBe(1.1);
  });

  it('ActionHandler should handle slower action', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { playbackRate: 1.0 });

    actionHandler.runAction('slower', 0.1);
    expect(mockVideo.playbackRate).toBe(0.9);
  });

  it('ActionHandler should respect speed limits', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { playbackRate: 16.0 });

    // Should not exceed maximum speed
    actionHandler.runAction('faster', 1.0);
    expect(mockVideo.playbackRate).toBe(16.0);

    // Test minimum speed
    mockVideo.playbackRate = 0.07;
    actionHandler.runAction('slower', 0.1);
    expect(mockVideo.playbackRate).toBe(0.07);
  });

  it('ActionHandler should handle pause action', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { paused: false });

    actionHandler.runAction('pause', 0);
    expect(mockVideo.paused).toBe(true);
  });

  it('ActionHandler should handle mute action', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { muted: false });
    actionHandler.runAction('muted', 0);

    expect(mockVideo.muted).toBe(true);
  });

  it('ActionHandler should handle volume actions', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { volume: 0.5 });
    actionHandler.runAction('louder', 0.1);
    expect(mockVideo.volume).toBe(0.6);

    actionHandler.runAction('softer', 0.2);
    expect(mockVideo.volume).toBe(0.4);
  });

  it('ActionHandler should handle seek actions', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { currentTime: 50 });

    actionHandler.runAction('advance', 10);
    expect(mockVideo.currentTime).toBe(60);

    actionHandler.runAction('rewind', 5);
    expect(mockVideo.currentTime).toBe(55);
  });

  it('ActionHandler should handle mark and jump actions', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createTestVideoWithController(config, actionHandler, { currentTime: 30 });

    // Set mark
    actionHandler.runAction('mark', 0);
    expect(mockVideo.vsc!.mark).toBe(30);

    // Change time
    mockVideo.currentTime = 50;

    // Jump to mark
    actionHandler.runAction('jump', 0);
    expect(mockVideo.currentTime).toBe(30);
  });

  it('ActionHandler should work with mark/jump key bindings', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler!(config, null);
    const eventManager = new window.VSC.EventManager!(config, actionHandler);
    actionHandler.eventManager = eventManager;

    const mockVideo = createTestVideoWithController(config, actionHandler, { currentTime: 25 });
    // Set initial mark to undefined for test
    mockVideo.vsc!.mark = undefined;

    // Verify mark key binding exists (M = 77)
    const markBinding = config.settings.keyBindings.find(
      (kb: { action: string; key: number }) => kb.action === 'mark'
    );
    expect(markBinding).toBeDefined();
    expect(markBinding!.key).toBe(77);

    const jumpBinding = config.settings.keyBindings.find(
      (kb: { action: string; key: number }) => kb.action === 'jump'
    );
    expect(jumpBinding).toBeDefined();
    expect(jumpBinding!.key).toBe(74);

    eventManager.handleKeydown({
      keyCode: 77,
      key: 'm',
      target: document.body,
      getModifierState: () => false,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent);
    expect(mockVideo.vsc!.mark).toBe(25);

    // Change video time
    mockVideo.currentTime = 60;

    eventManager.handleKeydown({
      keyCode: 74,
      key: 'j',
      target: document.body,
      getModifierState: () => false,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent);
    expect(mockVideo.currentTime).toBe(25);
  });

  it('ActionHandler should toggle display visibility', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const video = createTestVideoWithController(config, actionHandler);
    const controller = video.vsc!.div!;

    expect(controller.classList.contains('vsc-hidden')).toBe(false);
    expect(controller.classList.contains('vsc-manual')).toBe(false);

    actionHandler.runAction('display', 0, null);
    expect(controller.classList.contains('vsc-hidden')).toBe(true);
    expect(controller.classList.contains('vsc-manual')).toBe(true);

    actionHandler.runAction('display', 0, null);
    expect(controller.classList.contains('vsc-hidden')).toBe(false);
    expect(controller.classList.contains('vsc-manual')).toBe(true);

    actionHandler.runAction('display', 0, null);
    expect(controller.classList.contains('vsc-hidden')).toBe(true);
    expect(controller.classList.contains('vsc-manual')).toBe(true);
  });

  it('ActionHandler should work with videos in nested shadow DOM', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    // Create nested shadow DOM structure
    const host = document.createElement('div');
    const level1Shadow = host.attachShadow({ mode: 'open' });

    const nestedHost = document.createElement('div');
    level1Shadow.appendChild(nestedHost);
    const level2Shadow = nestedHost.attachShadow({ mode: 'open' });

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    level2Shadow.appendChild(mockVideo);

    document.body.appendChild(host);

    const mockSpeedIndicator = { textContent: '1.00', nodeType: 1, tagName: 'SPAN' };

    mockVideo.vsc = {
      div: mockDOM!.container,
      speedIndicator: mockSpeedIndicator,
      remove: () => {},
    };

    window.VSC.stateManager!.controllers.set('shadow-dom-test', {
      controller: { video: mockVideo },
      element: mockVideo,
      videoSrc: mockVideo.currentSrc || 'test-video',
      tagName: 'VIDEO',
      created: Date.now(),
    });

    // Test speed change on shadow DOM video
    actionHandler.runAction('faster', 0.2);
    expect(mockVideo.playbackRate).toBe(1.2);

    // Test slower action
    actionHandler.runAction('slower', 0.1);
    expect(mockVideo.playbackRate).toBe(1.1);

    // Test direct speed setting
    actionHandler.adjustSpeed(mockVideo, 2.5);
    expect(mockVideo.playbackRate).toBe(2.5);
    expect(mockVideo.vsc!.speedIndicator!.textContent).toBe('2.50');
  });

  it('adjustSpeed should handle absolute speed changes', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true; // Enable persistence for this test

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockVideo.vsc = {
      div: mockDOM!.container,
      speedIndicator: { textContent: '1.00' },
    };

    // Test absolute speed change
    actionHandler.adjustSpeed(mockVideo, 1.5);
    expect(mockVideo.playbackRate).toBe(1.5);
    expect(mockVideo.vsc!.speedIndicator!.textContent).toBe('1.50');
    expect(config.settings.lastSpeed).toBe(1.5);

    // Test speed limits
    actionHandler.adjustSpeed(mockVideo, 20); // Above max
    expect(mockVideo.playbackRate).toBe(16); // Clamped to max

    actionHandler.adjustSpeed(mockVideo, 0.01); // Below min
    expect(mockVideo.playbackRate).toBe(0.07); // Clamped to min
  });

  it('adjustSpeed should handle relative speed changes', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockVideo.vsc = {
      div: mockDOM!.container,
      speedIndicator: { textContent: '1.00' },
    };

    // Test relative speed increase
    actionHandler.adjustSpeed(mockVideo, 0.5, { relative: true });
    expect(mockVideo.playbackRate).toBe(1.5);

    // Test relative speed decrease
    actionHandler.adjustSpeed(mockVideo, -0.3, { relative: true });
    expect(mockVideo.playbackRate).toBe(1.2);

    // Test relative with limits
    mockVideo.playbackRate = 15.9;
    actionHandler.adjustSpeed(mockVideo, 0.5, { relative: true });
    expect(mockVideo.playbackRate).toBe(16); // Clamped to max
  });

  it('adjustSpeed should handle external changes with force mode', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    // Reset config state for clean test
    config.settings.rememberSpeed = false;

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockVideo.vsc = {
      div: mockDOM!.container,
      speedIndicator: { textContent: '1.00' },
    };

    // Set initial user preference
    config.settings.lastSpeed = 1.5;
    config.settings.forceLastSavedSpeed = true;
    config.settings.rememberSpeed = true; // Global mode for force test

    // External change should be rejected in force mode
    actionHandler.adjustSpeed(mockVideo, 2.0, { source: 'external' });
    expect(mockVideo.playbackRate).toBe(1.5); // Restored to user preference

    // Internal change should be allowed
    actionHandler.adjustSpeed(mockVideo, 2.0, { source: 'internal' });
    expect(mockVideo.playbackRate).toBe(2.0);
  });

  it('getPreferredSpeed should return global lastSpeed', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createMockVideo({
      playbackRate: 1.0,
      currentSrc: 'https://example.com/video1.mp4',
    });

    // Test with set lastSpeed
    config.settings.lastSpeed = 1.75;
    expect(actionHandler.getPreferredSpeed(mockVideo)).toBe(1.75);

    // Test fallback when no lastSpeed
    config.settings.lastSpeed = null;
    expect(actionHandler.getPreferredSpeed(mockVideo)).toBe(1.0);

    // Different video should return same global speed
    const mockVideo2 = createMockVideo({
      currentSrc: 'https://example.com/video2.mp4',
    });
    config.settings.lastSpeed = 2.5;
    expect(actionHandler.getPreferredSpeed(mockVideo2)).toBe(2.5);
  });

  it('adjustSpeed should validate input properly', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    // Test with null video - use assertion for invalid input test
    actionHandler.adjustSpeed(null as unknown as import('../../../src/types/settings').VscMedia, 1.5);
    // Should not throw, just log warning

    // Test with video without controller
    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    delete mockVideo.vsc;
    const initialSpeed = mockVideo.playbackRate;
    actionHandler.adjustSpeed(mockVideo, 1.5);
    expect(mockVideo.playbackRate).toBe(initialSpeed); // Should not change

    const validVideo = createTestVideoWithController(config, actionHandler, { playbackRate: 1.0 });

    actionHandler.adjustSpeed(validVideo, '1.5' as unknown as number);
    expect(validVideo.playbackRate).toBe(1.0);

    actionHandler.adjustSpeed(validVideo, null as unknown as number);
    expect(validVideo.playbackRate).toBe(1.0);

    actionHandler.adjustSpeed(validVideo, undefined as unknown as number);
    expect(validVideo.playbackRate).toBe(1.0); // Should not change

    // NaN value
    actionHandler.adjustSpeed(validVideo, NaN);
    expect(validVideo.playbackRate).toBe(1.0); // Should not change
  });

  it('setSpeed should save global speed to storage', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true; // Enable persistence for this test

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const mockVideo = createMockVideo({
      playbackRate: 1.0,
      currentSrc: 'https://example.com/video.mp4',
    });
    mockVideo.vsc = {
      div: mockDOM!.container,
      speedIndicator: { textContent: '1.00' },
    };

    let savedData: { lastSpeed?: number } | null = null;
    (config as typeof config & { save: (data: { lastSpeed?: number }) => void }).save = (
      data: { lastSpeed?: number }
    ) => {
      savedData = data;
    };

    actionHandler.setSpeed(mockVideo, 1.5, 'internal');

    expect(savedData!.lastSpeed).toBe(1.5);
    expect(config.settings.lastSpeed).toBe(1.5); // Global speed updated
  });

  it('do not persist video speed to storage', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = false;
    config.settings.forceLastSavedSpeed = false;

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    // Create two different videos with controllers
    const video1 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://example.com/video1.mp4',
    });
    const video2 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://example.com/video2.mp4',
    });

    const savedCalls: Array<Record<string, unknown>> = [];
    const originalSave = config.save;
    (config as typeof config & { save: (data: Record<string, unknown>) => Promise<void> }).save = (
      data: Record<string, unknown>
    ) => {
      savedCalls.push({ ...data });
      return originalSave.call(config, data);
    };

    // Change speeds on different videos
    await actionHandler.adjustSpeed(video1, 1.5);
    await actionHandler.adjustSpeed(video2, 2.0);

    // With rememberSpeed = false, no speeds should be persisted to storage
    expect(savedCalls.length).toBe(0);

    // Videos should still have their playback rates set
    expect(video1.playbackRate).toBe(1.5);
    expect(video2.playbackRate).toBe(2.0);
  });

  it('rememberSpeed: true should only store global speed', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true;
    config.settings.forceLastSavedSpeed = false;

    // Clear any existing speeds from previous tests

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const video1 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://example.com/video1.mp4',
    });
    const video2 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://example.com/video2.mp4',
    });

    // Change speeds on different videos
    await actionHandler.adjustSpeed(video1, 1.5);
    await actionHandler.adjustSpeed(video2, 2.0);

    // Global lastSpeed should be updated
    expect(config.settings.lastSpeed).toBe(2.0);
  });

  it('speed limits should be enforced correctly', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler!(config, null);
    const video = createTestVideoWithController(config, actionHandler, { playbackRate: 1.0 });

    // Test minimum speed limit
    await actionHandler.adjustSpeed(video, 0.01); // Below minimum
    expect(video.playbackRate).toBe(0.07); // Should clamp to minimum

    // Test maximum speed limit
    await actionHandler.adjustSpeed(video, 20.0); // Above maximum
    expect(video.playbackRate).toBe(16.0); // Should clamp to maximum

    // Test negative speed (should clamp to minimum)
    await actionHandler.adjustSpeed(video, -1.0);
    expect(video.playbackRate).toBe(0.07);
  });

  // COMPREHENSIVE PHASE 6 TESTS
  it('adjustSpeed should handle complex relative mode scenarios', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler!(config, null);
    const video = createTestVideoWithController(config, actionHandler, { playbackRate: 2.0 });

    // Test relative from various starting points
    actionHandler.adjustSpeed(video, 0.25, { relative: true });
    expect(video.playbackRate).toBe(2.25);

    // Test relative with float precision
    actionHandler.adjustSpeed(video, 0.33, { relative: true });
    expect(video.playbackRate).toBe(2.58); // Should be rounded to 2 decimals

    // Test relative from very low speed
    video.playbackRate = 0.05; // Below 0.1 threshold
    actionHandler.adjustSpeed(video, 0.1, { relative: true });
    expect(video.playbackRate).toBe(0.1); // Should use 0.0 as base for very low speeds

    // Test large relative changes
    video.playbackRate = 1.0;
    actionHandler.adjustSpeed(video, 5.0, { relative: true });
    expect(video.playbackRate).toBe(6.0);
  });

  it('adjustSpeed should handle multiple source types comprehensively', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true;
    config.settings.lastSpeed = 1.25;

    const actionHandler = new window.VSC.ActionHandler!(config, null);
    const video = createTestVideoWithController(config, actionHandler, { playbackRate: 1.0 });

    // Test default source (should be 'internal')
    actionHandler.adjustSpeed(video, 1.5);
    expect(video.playbackRate).toBe(1.5);

    // Test explicit internal source
    actionHandler.adjustSpeed(video, 1.8, { source: 'internal' });
    expect(video.playbackRate).toBe(1.8);

    // Test external source without force mode
    config.settings.forceLastSavedSpeed = false;
    actionHandler.adjustSpeed(video, 2.5, { source: 'external' });
    expect(video.playbackRate).toBe(2.5);

    // Test external source with force mode enabled
    config.settings.forceLastSavedSpeed = true;
    actionHandler.adjustSpeed(video, 3.0, { source: 'external' });
    expect(video.playbackRate).toBe(2.5); // Should be blocked and restored to last internal change
  });

  it('adjustSpeed should work correctly with multiple videos', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true; // Enable persistence for this test

    const actionHandler = new window.VSC.ActionHandler!(config, null);

    // Create multiple videos with different sources
    const video1 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://site1.com/video1.mp4',
    });
    const video2 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://site2.com/video2.mp4',
    });
    const video3 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://site1.com/video3.mp4',
    });

    // Set different speeds for each video
    actionHandler.adjustSpeed(video1, 1.5);
    actionHandler.adjustSpeed(video2, 2.0);
    actionHandler.adjustSpeed(video3, 1.25);

    // Verify each video has correct speed
    expect(video1.playbackRate).toBe(1.5);
    expect(video2.playbackRate).toBe(2.0);
    expect(video3.playbackRate).toBe(1.25);

    // Verify global speed behavior - all videos share same preferred speed
    expect(actionHandler.getPreferredSpeed(video1)).toBe(1.25);
    expect(actionHandler.getPreferredSpeed(video2)).toBe(1.25);
    expect(actionHandler.getPreferredSpeed(video3)).toBe(1.25);
  });

  it('adjustSpeed should handle global mode with multiple videos', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = true; // Global mode

    const actionHandler = new window.VSC.ActionHandler!(config, null);

    const video1 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://site1.com/video1.mp4',
    });
    const video2 = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://site2.com/video2.mp4',
    });

    // Change speed on first video
    actionHandler.adjustSpeed(video1, 1.8);
    expect(config.settings.lastSpeed).toBe(1.8);

    // getPreferredSpeed should return global speed for both videos
    expect(actionHandler.getPreferredSpeed(video1)).toBe(1.8);
    expect(actionHandler.getPreferredSpeed(video2)).toBe(1.8);

    // Change speed on second video
    actionHandler.adjustSpeed(video2, 2.2);
    expect(config.settings.lastSpeed).toBe(2.2);

    // Both videos should now prefer the new global speed
    expect(actionHandler.getPreferredSpeed(video1)).toBe(2.2);
    expect(actionHandler.getPreferredSpeed(video2)).toBe(2.2);
  });

  it('adjustSpeed should handle edge cases and error conditions', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler!(config, null);

    // Test with video missing vsc property
    const videoNoVsc = createMockVideo({ playbackRate: 1.0 });
    actionHandler.adjustSpeed(videoNoVsc, 1.5); // Should not crash, just warn

    // Test with video missing speedIndicator
    const videoNoIndicator = createMockVideo({ playbackRate: 1.0 });
    videoNoIndicator.vsc = {}; // No speedIndicator
    window.VSC.stateManager!.controllers.set('test-no-indicator', {
      controller: { video: videoNoIndicator },
      element: videoNoIndicator,
      videoSrc: 'test-video',
      tagName: 'VIDEO',
      created: Date.now(),
    });
    actionHandler.adjustSpeed(videoNoIndicator, 1.5); // Should work but skip UI update
    expect(videoNoIndicator.playbackRate).toBe(1.5);

    // Test with very small incremental changes
    const video = createTestVideoWithController(config, actionHandler, { playbackRate: 1.0 });

    actionHandler.adjustSpeed(video, 0.001, { relative: true });
    expect(video.playbackRate).toBe(1.0); // Should round to 2 decimals (1.00)

    actionHandler.adjustSpeed(video, 0.01, { relative: true });
    expect(video.playbackRate).toBe(1.01); // Should round to 1.01
  });

  it('adjustSpeed should handle complex force mode scenarios', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.forceLastSavedSpeed = true;
    config.settings.rememberSpeed = false; // Per-video mode
    config.settings.lastSpeed = 1.5;

    const actionHandler = new window.VSC.ActionHandler!(config, null);

    const video = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://example.com/video.mp4',
    });

    // External changes should be blocked and restored to global speed
    actionHandler.adjustSpeed(video, 3.0, { source: 'external' });
    expect(video.playbackRate).toBe(1.5);

    // Internal changes should work normally
    actionHandler.adjustSpeed(video, 1.8, { source: 'internal' });
    expect(video.playbackRate).toBe(1.8);
  });

  it('reset action should use configured reset speed value', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    // Test with default reset speed (1.0)
    const mockVideo1 = createTestVideoWithController(config, actionHandler, { playbackRate: 2.0 });
    actionHandler.runAction('reset', 1.0); // Pass the value as keyboard handler would
    expect(mockVideo1.playbackRate).toBe(1.0);

    // Test with custom reset speed
    config.setKeyBinding('reset', 1.5);
    const mockVideo2 = createTestVideoWithController(config, actionHandler, { playbackRate: 2.5 });
    actionHandler.runAction('reset', 1.5); // Pass the custom value
    expect(mockVideo2.playbackRate).toBe(1.5);

    // Test reset memory toggle functionality with custom reset speed
    const mockVideo3 = createTestVideoWithController(config, actionHandler, { playbackRate: 1.5 });

    // First reset should remember current speed and go to reset speed
    mockVideo3.playbackRate = 2.2;
    actionHandler.runAction('reset', 1.5); // Pass custom value
    expect(mockVideo3.playbackRate).toBe(1.5); // Should reset to configured value
    expect(mockVideo3.vsc!.speedBeforeReset).toBe(2.2); // Should remember previous speed

    // Second reset should restore remembered speed
    actionHandler.runAction('reset', 1.5); // Pass custom value
    expect(mockVideo3.playbackRate).toBe(2.2); // Should restore remembered speed
    expect(mockVideo3.vsc!.speedBeforeReset).toBe(null); // Should clear memory
  });

  it('lastSpeed should update during session even when rememberSpeed is false', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();
    config.settings.rememberSpeed = false; // Disable cross-session persistence
    config.settings.lastSpeed = 1.0; // Start with default speed

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const savedCalls: Array<Record<string, unknown>> = [];
    const originalSave = config.save;
    (config as typeof config & { save: (data: Record<string, unknown>) => Promise<void> }).save =
      function (data: Record<string, unknown>) {
        savedCalls.push({ ...data });
        return originalSave.call(config, data);
      };

    const video = createTestVideoWithController(config, actionHandler, {
      currentSrc: 'https://example.com/video.mp4',
    });

    // Change speed to 1.4
    await actionHandler.adjustSpeed(video, 1.4);

    // lastSpeed should be updated in memory for session persistence
    expect(config.settings.lastSpeed).toBe(1.4);

    // No storage saves should occur
    expect(savedCalls.length).toBe(0);

    expect(actionHandler.getPreferredSpeed(video)).toBe(1.4);

    // Restore original save method
    config.save = originalSave;
  });

  it('reset action should work with keyboard event simulation', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler!(config, null);
    const eventManager = new window.VSC.EventManager!(config, actionHandler);
    actionHandler.eventManager = eventManager;

    // Test with custom reset speed via keyboard simulation
    config.setKeyBinding('reset', 1.5);
    const mockVideo = createTestVideoWithController(config, actionHandler, { playbackRate: 2.0 });

    eventManager.handleKeydown(
      new KeyboardEvent('keydown', { key: 'r', keyCode: 82, bubbles: true })
    );

    expect(mockVideo.playbackRate).toBe(1.5); // Should use configured reset speed
  });
});
