/**
 * Unit tests for VideoSpeedExtension (inject.js)
 * Testing the fix for video elements without parentElement
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockVideo,
  createMockDOM,
} from '../../helpers/test-utils.js';
import { loadInjectModules } from '../../helpers/module-loader.js';
import { MESSAGE_TYPES, BRIDGE_SOURCES, BRIDGE_ACTIONS } from '../../../src/utils/message-types.ts';

// Load all required modules
await loadInjectModules();

let mockDOM;
let extension;
let originalStateManager;
let originalVideoSpeedConfig;

/**
 * Create a video element without parentElement but with parentNode
 * This simulates shadow DOM scenarios where parentElement is undefined
 */
function createVideoWithoutParentElement() {
  const video = createMockVideo();
  const parentNode = document.createElement('div');

  // Simulate shadow DOM scenario where parentElement is undefined
  Object.defineProperty(video, 'parentElement', {
    value: null,
    writable: false,
    configurable: true,
  });

  Object.defineProperty(video, 'parentNode', {
    value: parentNode,
    writable: false,
    configurable: true,
  });

  // Mock isConnected property for validity check
  Object.defineProperty(video, 'isConnected', {
    value: true,
    writable: false,
    configurable: true,
  });

  return { video, parentNode };
}

describe('VideoSpeedExtension', () => {
  beforeEach(() => {
    mockDOM = createMockDOM();
    originalStateManager = window.VSC.stateManager;
    originalVideoSpeedConfig = window.VSC.videoSpeedConfig;

    // Initialize site handler manager for tests
    if (window.VSC && window.VSC.siteHandlerManager) {
      window.VSC.siteHandlerManager.initialize(document);
    }
  });

  afterEach(() => {
    if (mockDOM) {
      mockDOM.cleanup();
    }
    if (extension) {
      extension = null;
    }

    window.VSC.stateManager = originalStateManager;
    window.VSC.videoSpeedConfig = originalVideoSpeedConfig;

    // Clean up any remaining video elements
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video.vsc) {
        try {
          video.vsc.remove();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (video.parentNode) {
        try {
          video.parentNode.removeChild(video);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  it('onVideoFound should handle video elements without parentElement', async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Ensure extension is initialized
    if (!extension) {
      expect(false).toBe(true);
      return;
    }

    try {
      // Create a video element without parentElement but with parentNode
      const { video, parentNode } = createVideoWithoutParentElement();

      // Test the onVideoFound method directly - this is the core functionality
      extension.onVideoFound(video, parentNode);

      // Verify that the video controller was attached
      expect(video.vsc).toBeDefined();
      expect(typeof video.vsc.remove === 'function').toBe(true);

      // Verify that the controller was initialized with the correct parent (parentNode fallback)
      expect(video.vsc.parent).toBe(parentNode);
    } catch (error) {
      console.error('Test error:', error);
      expect(false).toBe(true);
    }
  });

  it('onVideoFound should prefer parentElement when available', async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Ensure extension is initialized
    if (!extension) {
      expect(false).toBe(true);
      return;
    }

    try {
      // Create a normal video element with both parentElement and parentNode
      const video = createMockVideo();
      const parentElement = document.createElement('div');
      const parentNode = document.createElement('span'); // Different from parentElement

      Object.defineProperty(video, 'parentElement', {
        value: parentElement,
        writable: false,
        configurable: true,
      });

      Object.defineProperty(video, 'parentNode', {
        value: parentNode,
        writable: false,
        configurable: true,
      });

      // Mock isConnected property for validity check
      Object.defineProperty(video, 'isConnected', {
        value: true,
        writable: false,
        configurable: true,
      });

      // Test onVideoFound with parentElement available
      extension.onVideoFound(video, parentNode);

      // Verify that the video controller was attached
      expect(video.vsc).toBeDefined();

      // Verify that the controller was initialized with video.parentElement (not the passed parent)
      // VideoController constructor uses target.parentElement || parent
      expect(video.vsc.parent).toBe(parentElement);
    } catch (error) {
      expect(false).toBe(true);
    }
  });

  it('onVideoFound should handle video with neither parentElement nor parentNode', async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Verify extension is available
    expect(extension).toBeDefined();

    try {
      // Create a video element with no parent references
      const video = createMockVideo();
      const fallbackParent = document.createElement('div');

      Object.defineProperty(video, 'parentElement', {
        value: null,
        writable: false,
        configurable: true,
      });

      Object.defineProperty(video, 'parentNode', {
        value: null,
        writable: false,
        configurable: true,
      });

      // Mock isConnected property for validity check
      Object.defineProperty(video, 'isConnected', {
        value: true,
        writable: false,
        configurable: true,
      });

      // This should not throw an error even with no parent references
      extension.onVideoFound(video, fallbackParent);

      // Verify basic functionality
      expect(video.vsc).toBeDefined();
      expect(video.vsc.parent).toBe(fallbackParent);
    } catch (error) {
      expect(false).toBe(true);
    }
  });

  it('handleRuntimeMessage should set speed for controlled and uncontrolled media', async () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();
    const adjustedCalls = [];
    const controlledVideo = createMockVideo();
    const uncontrolledVideo = createMockVideo();

    controlledVideo.vsc = { div: document.createElement('div') };
    controlledVideo.playbackRate = 1.0;
    uncontrolledVideo.playbackRate = 1.0;

    localExtension.actionHandler = {
      adjustSpeed: (video, speed, options) => {
        adjustedCalls.push({ video, speed, options });
      },
      resetSpeed: () => {},
      runAction: () => {},
    };

    localExtension.getAllMediaElements = () => [controlledVideo, uncontrolledVideo];

    localExtension.handleRuntimeMessage({
      type: MESSAGE_TYPES.SET_SPEED,
      payload: { speed: 1.75 },
    });

    expect(adjustedCalls.length).toBe(1);
    expect(adjustedCalls[0].video).toBe(controlledVideo);
    expect(adjustedCalls[0].speed).toBe(1.75);
    expect(uncontrolledVideo.playbackRate).toBe(1.75);
  });

  it('handleRuntimeMessage should post site info for popup requests', async () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();
    const originalPostMessage = window.postMessage;
    const postedMessages = [];
    const video = createMockVideo();

    video.playbackRate = 1.5;

    localExtension.getAllMediaElements = () => [video];
    localExtension.config = {
      settings: { lastSpeed: 1.25 },
      getSiteProfile: () => ({ speed: 1.5 }),
    };
    window.postMessage = (payload) => {
      postedMessages.push(payload);
    };

    try {
      localExtension.handleRuntimeMessage({
        type: MESSAGE_TYPES.GET_SITE_INFO,
      });

      expect(postedMessages.length).toBe(1);
      expect(postedMessages[0].source).toBe('vsc-page');
      expect(postedMessages[0].action).toBe('current-speed-response');
      expect(postedMessages[0].data.speed).toBe(1.5);
      expect(postedMessages[0].data.hasProfile).toBe(true);
    } finally {
      window.postMessage = originalPostMessage;
    }
  });

  it('handleRuntimeMessage GET_SITE_INFO should use max playback rate for multi-video', async () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();
    const originalPostMessage = window.postMessage;
    const postedMessages = [];
    const video1 = createMockVideo();
    const video2 = createMockVideo();

    video1.playbackRate = 1.0;
    video2.playbackRate = 2.0;

    localExtension.getAllMediaElements = () => [video1, video2];
    localExtension.config = {
      settings: { lastSpeed: 1.0 },
      getSiteProfile: () => null,
    };
    window.postMessage = (payload) => {
      postedMessages.push(payload);
    };

    try {
      localExtension.handleRuntimeMessage({
        type: MESSAGE_TYPES.GET_SITE_INFO,
      });

      expect(postedMessages.length).toBe(1);
      expect(postedMessages[0].data.speed).toBe(2.0);
    } finally {
      window.postMessage = originalPostMessage;
    }
  });

  it('attachControllersToMedia should skip duplicate and pending media attachments', () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();
    const attached = [];
    const freshVideo = createMockVideo();
    const existingVideo = createMockVideo();
    const pendingVideo = createMockVideo();

    existingVideo.vsc = { div: document.createElement('div') };
    window.VSC.stateManager = {
      hasMediaElement: (video) => video === existingVideo,
    };
    localExtension.onVideoFound = (video) => {
      attached.push(video);
      video.vsc = { div: document.createElement('div') };
    };
    localExtension.markControllerPending(pendingVideo);

    const attachedCount = localExtension.attachControllersToMedia([
      freshVideo,
      existingVideo,
      pendingVideo,
    ]);

    expect(attachedCount).toBe(1);
    expect(attached.length).toBe(1);
    expect(attached[0]).toBe(freshVideo);
  });

  it('shouldRunComprehensiveScan should only allow one scan per document', () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();

    expect(localExtension.shouldRunComprehensiveScan(document)).toBe(true);
    expect(localExtension.shouldRunComprehensiveScan(document)).toBe(false);
  });

  it('registerMessageHandler should ignore duplicate registration', () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();

    // Call registerMessageHandler twice
    localExtension.registerMessageHandler();
    localExtension.registerMessageHandler();

    // The flag should prevent a second listener from being attached
    expect(localExtension.messageHandlerRegistered).toBe(true);
  });

  it('initializeDocument should initialize each document once', () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();
    const iframeDocument = document.implementation.createHTMLDocument('iframe-doc');
    const listenerDocs = [];
    const deferredDocs = [];
    const cssDocs = [];

    localExtension.eventManager = {
      setupEventListeners: (doc) => {
        listenerDocs.push(doc);
      },
    };
    localExtension.deferExpensiveOperations = (doc) => {
      deferredDocs.push(doc);
    };
    localExtension.setupDocumentCSS = (doc) => {
      cssDocs.push(doc);
    };

    localExtension.initializeDocument(document);
    localExtension.initializeDocument(document);
    localExtension.initializeDocument(iframeDocument);
    localExtension.initializeDocument(iframeDocument);

    expect(listenerDocs.length).toBe(2);
    expect(deferredDocs.length).toBe(2);
    expect(cssDocs.length).toBe(1);
    expect(cssDocs[0]).toBe(iframeDocument);
  });
});
