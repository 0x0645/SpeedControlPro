/**
 * Tests for audio element size handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockDOM, type MockDOM } from '../../helpers/test-utils';
import { loadCoreModules } from '../../helpers/module-loader';

await loadCoreModules();

let mockDOM: MockDOM | undefined;

// Test constants - values guaranteed to be below the minimum controller size limits
const SMALL_AUDIO_SIZE = {
  WIDTH: 20, // Below AUDIO_MIN_WIDTH (25)
  HEIGHT: 15, // Below AUDIO_MIN_HEIGHT (25)
};

const SMALL_VIDEO_SIZE = {
  WIDTH: 40, // Below VIDEO_MIN_WIDTH (50)
  HEIGHT: 30, // Below VIDEO_MIN_HEIGHT (50)
};

interface MockAudioOptions {
  readyState?: number;
  currentSrc?: string;
  width?: number;
  height?: number;
  playbackRate?: number;
  currentTime?: number;
  volume?: number;
  muted?: boolean;
  src?: string;
  duration?: number;
  paused?: boolean;
}

function createMockAudio(options: MockAudioOptions = {}) {
  const audio = document.createElement('audio');

  Object.defineProperties(audio, {
    readyState: {
      value: options.readyState ?? 2,
      writable: true,
      configurable: true,
    },
    currentSrc: {
      value: options.currentSrc ?? 'https://example.com/audio.mp3',
      writable: true,
      configurable: true,
    },
    ownerDocument: {
      value: document,
      writable: true,
      configurable: true,
    },
  });

  const width = options.width ?? SMALL_AUDIO_SIZE.WIDTH;
  const height = options.height ?? SMALL_AUDIO_SIZE.HEIGHT;
  audio.getBoundingClientRect = () =>
    new DOMRect(0, 0, width, height);

  // Mock isConnected
  Object.defineProperty(audio, 'isConnected', {
    value: true,
    configurable: true,
  });

  // Mock parentElement needed for controller insertion
  Object.defineProperty(audio, 'parentElement', {
    get() {
      return audio.parentNode;
    },
    configurable: true,
  });

  const mutable = audio as HTMLAudioElement & {
    playbackRate: number;
    currentTime: number;
    volume: number;
    muted: boolean;
    src: string;
  };
  mutable.playbackRate = options.playbackRate ?? 1.0;
  mutable.currentTime = options.currentTime ?? 0;
  mutable.volume = options.volume ?? 1.0;
  mutable.muted = options.muted ?? false;
  mutable.src = options.src ?? 'https://example.com/audio.mp3';

  Object.defineProperty(audio, 'duration', {
    value: options.duration ?? 100,
    writable: false,
    configurable: true,
  });

  Object.defineProperty(audio, 'paused', {
    value: options.paused ?? false,
    writable: false,
    configurable: true,
  });

  const eventListeners = new Map<string, EventListener[]>();
  audio.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
    const key = type;
    if (!eventListeners.has(key)) {
      eventListeners.set(key, []);
    }
    eventListeners.get(key)!.push(listener as EventListener);
  };

  audio.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
    const listeners = eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener as EventListener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  };

  audio.dispatchEvent = (event: Event) => {
    const listeners = eventListeners.get(event.type);
    if (listeners) {
      (event as { target?: EventTarget }).target = audio;
      listeners.forEach((listener) => listener(event));
    }
    return true;
  };

  return audio;
}

describe('AudioSizeHandling', () => {
  beforeEach(() => {
    mockDOM = createMockDOM();

    // Clear any media elements from previous tests
    if (window.VSC && window.VSC.videoSpeedConfig) {
      window.VSC.videoSpeedConfig.mediaTags = [];
    }
  });

  afterEach(() => {
    if (mockDOM) {
      mockDOM!.cleanup();
    }
  });

  it('MediaElementObserver should allow small audio when audioBoolean enabled', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    config.settings.audioBoolean = true;

    window.VSC.siteHandlerManager!.initialize(document);
    const observer = new window.VSC.MediaElementObserver!(
      config,
      window.VSC.siteHandlerManager as unknown as import('../../../src/site-handlers/index').SiteHandlerManager
    );

    const smallAudio = createMockAudio({
      width: SMALL_AUDIO_SIZE.WIDTH,
      height: SMALL_AUDIO_SIZE.HEIGHT,
    });
    document.body.appendChild(smallAudio);

    const isValid = observer.isValidMediaElement(smallAudio);
    expect(isValid).toBe(true);

    // Cleanup
    document.body.removeChild(smallAudio);
  });

  it('MediaElementObserver should reject small audio when audioBoolean disabled', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    config.settings.audioBoolean = false;

    window.VSC.siteHandlerManager!.initialize(document);
    const observer = new window.VSC.MediaElementObserver!(
      config,
      window.VSC.siteHandlerManager as unknown as import('../../../src/site-handlers/index').SiteHandlerManager
    );

    const smallAudio = createMockAudio({
      width: SMALL_AUDIO_SIZE.WIDTH,
      height: SMALL_AUDIO_SIZE.HEIGHT,
    });
    document.body.appendChild(smallAudio);

    const isValid = observer.isValidMediaElement(smallAudio);
    expect(isValid).toBe(false);

    // Cleanup
    document.body.removeChild(smallAudio);
  });

  it('VideoController should start visible for small audio elements', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    config.settings.audioBoolean = true;
    config.settings.startHidden = false;

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const smallAudio = createMockAudio({
      width: SMALL_AUDIO_SIZE.WIDTH,
      height: SMALL_AUDIO_SIZE.HEIGHT,
    });
    mockDOM!.container.appendChild(smallAudio);

    window.VSC.siteHandlerManager!.initialize(document);
    const observer = new window.VSC.MediaElementObserver!(
      config,
      window.VSC.siteHandlerManager as unknown as import('../../../src/site-handlers/index').SiteHandlerManager
    );
    const shouldStartHidden = observer.shouldStartHidden(smallAudio);

    const controller = new window.VSC.VideoController!(
      smallAudio,
      null,
      config,
      actionHandler,
      shouldStartHidden
    );

    // Check that controller was created
    expect(controller.div).toBeDefined();

    // Check that it starts visible (size no longer matters)
    expect(controller.div.classList.contains('vsc-hidden')).toBe(false);

    // Verify it's not hidden (uses natural visibility)
    expect(controller.div.classList.contains('vsc-hidden')).toBe(false);

    controller.remove();
    mockDOM!.container.removeChild(smallAudio);
  });

  it('VideoController should accept all video sizes', async () => {
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    window.VSC.siteHandlerManager!.initialize(document);
    const observer = new window.VSC.MediaElementObserver!(
      config,
      window.VSC.siteHandlerManager as unknown as import('../../../src/site-handlers/index').SiteHandlerManager
    );

    const smallVideo = document.createElement('video');
    smallVideo.getBoundingClientRect = () =>
      new DOMRect(0, 0, SMALL_VIDEO_SIZE.WIDTH, SMALL_VIDEO_SIZE.HEIGHT);

    Object.defineProperty(smallVideo, 'isConnected', {
      value: true,
      configurable: true,
    });

    Object.defineProperty(smallVideo, 'readyState', {
      value: 2,
      configurable: true,
    });

    document.body.appendChild(smallVideo);

    const isValid = observer.isValidMediaElement(smallVideo);
    expect(isValid).toBe(true);

    // Check if it would start hidden (should not due to size)
    const shouldStartHidden = observer.shouldStartHidden(smallVideo);
    expect(shouldStartHidden).toBe(false);

    // Cleanup
    document.body.removeChild(smallVideo);
  });

  it('Display toggle should work with audio controllers', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    window.VSC.videoSpeedConfig = new VideoSpeedConfig();
    const config = window.VSC.videoSpeedConfig!;
    await config.load();

    if (window.VSC && window.VSC.stateManager) {
      window.VSC.stateManager.__resetForTests();
    }

    config.settings.audioBoolean = true;

    const eventManager = new window.VSC.EventManager!(config, null);
    const actionHandler = new window.VSC.ActionHandler!(config, eventManager);

    const smallAudio = createMockAudio({
      width: SMALL_AUDIO_SIZE.WIDTH,
      height: SMALL_AUDIO_SIZE.HEIGHT,
    });
    mockDOM!.container.appendChild(smallAudio);

    window.VSC.siteHandlerManager!.initialize(document);
    const observer = new window.VSC.MediaElementObserver!(
      config,
      window.VSC.siteHandlerManager as unknown as import('../../../src/site-handlers/index').SiteHandlerManager
    );
    const shouldStartHidden = observer.shouldStartHidden(smallAudio);

    const controller = new window.VSC.VideoController!(
      smallAudio,
      mockDOM!.container,
      config,
      actionHandler,
      shouldStartHidden
    );

    // Verify controller was created properly
    expect(controller).toBeDefined();
    expect(controller.div).toBeDefined();
    expect(smallAudio.vsc).toBeDefined();
    expect(smallAudio.vsc).toBe(controller);

    // Verify starts visible (size checks removed)
    expect(controller.div.classList.contains('vsc-hidden')).toBe(false);

    const mediaElements = window.VSC.stateManager!.getAllMediaElements();
    expect(mediaElements.includes(smallAudio)).toBe(true);
    expect(mediaElements.length).toBe(1);

    // Toggle display using action handler
    actionHandler.runAction('display', 0, null);

    // Should now be hidden after first toggle
    expect(controller.div.classList.contains('vsc-hidden')).toBe(true);
    expect(controller.div.classList.contains('vsc-manual')).toBe(true);

    // Toggle again
    actionHandler.runAction('display', 0, null);

    // Should be visible again after second toggle
    expect(controller.div.classList.contains('vsc-hidden')).toBe(false);

    controller.remove();
    mockDOM!.container.removeChild(smallAudio);
  });
});
