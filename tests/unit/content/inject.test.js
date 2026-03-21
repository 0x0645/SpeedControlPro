/**
 * Unit tests for VideoSpeedExtension (inject.js)
 * Testing the fix for video elements without parentElement
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import {
  SimpleTestRunner,
  assert,
  createMockVideo,
  createMockDOM,
} from '../../helpers/test-utils.js';
import { loadInjectModules } from '../../helpers/module-loader.js';

// Load all required modules
await loadInjectModules();

const runner = new SimpleTestRunner();
let mockDOM;
let extension;
let originalStateManager;
let originalVideoSpeedConfig;

runner.beforeEach(() => {
  installChromeMock();
  resetMockStorage();
  mockDOM = createMockDOM();
  originalStateManager = window.VSC.stateManager;
  originalVideoSpeedConfig = window.VSC.videoSpeedConfig;

  // Initialize site handler manager for tests
  if (window.VSC && window.VSC.siteHandlerManager) {
    window.VSC.siteHandlerManager.initialize(document);
  }
});

runner.afterEach(() => {
  cleanupChromeMock();
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
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (video.parentNode) {
      try {
        video.parentNode.removeChild(video);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
});

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

runner.test('onVideoFound should handle video elements without parentElement', async () => {
  // Use the global VSC_controller instance
  extension = window.VSC_controller;

  // Ensure extension is initialized
  if (!extension) {
    assert.true(false, 'VSC_controller should be available on window');
    return;
  }

  try {
    // Create a video element without parentElement but with parentNode
    const { video, parentNode } = createVideoWithoutParentElement();

    // Test the onVideoFound method directly - this is the core functionality
    extension.onVideoFound(video, parentNode);

    // Verify that the video controller was attached
    assert.exists(video.vsc, 'Video controller should be attached to the video element');
    assert.true(
      video.vsc instanceof window.VSC.VideoController,
      'Should create VideoController instance'
    );

    // Verify that the controller was initialized with the correct parent (parentNode fallback)
    assert.equal(
      video.vsc.parent,
      parentNode,
      'VideoController should use parentNode when parentElement is null'
    );
  } catch (error) {
    console.error('Test error:', error);
    assert.true(false, `Test should not throw error: ${error.message}`);
  }
});

runner.test('onVideoFound should prefer parentElement when available', async () => {
  // Use the global VSC_controller instance
  extension = window.VSC_controller;

  // Ensure extension is initialized
  if (!extension) {
    assert.true(false, 'VSC_controller should be available on window');
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
    assert.exists(video.vsc, 'Video controller should be attached to the video element');

    // Verify that the controller was initialized with video.parentElement (not the passed parent)
    // VideoController constructor uses target.parentElement || parent
    assert.equal(
      video.vsc.parent,
      parentElement,
      'VideoController should prefer video.parentElement when available'
    );
  } catch (error) {
    assert.true(false, `Test should not throw error: ${error.message}`);
  }
});

runner.test(
  'onVideoFound should handle video with neither parentElement nor parentNode',
  async () => {
    // Use the global VSC_controller instance
    extension = window.VSC_controller;

    // Verify extension is available
    assert.exists(extension, 'VSC_controller should be available on window');

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
      assert.exists(
        video.vsc,
        'Video controller should be attached even without parent references'
      );
      assert.equal(
        video.vsc.parent,
        fallbackParent,
        'VideoController should use provided fallback parent'
      );
    } catch (error) {
      assert.true(false, `Test should not throw error: ${error.message}`);
    }
  }
);

runner.test(
  'handleRuntimeMessage should set speed for controlled and uncontrolled media',
  async () => {
    const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
    const localExtension = new VideoSpeedExtension();
    const adjustedCalls = [];
    const controlledVideo = createMockVideo();
    const uncontrolledVideo = createMockVideo();

    controlledVideo.vsc = { div: document.createElement('div') };
    controlledVideo.playbackRate = 1.0;
    uncontrolledVideo.playbackRate = 1.0;

    localExtension.MESSAGE_TYPES = window.VSC.Constants.MESSAGE_TYPES;
    localExtension.actionHandler = {
      adjustSpeed: (video, speed, options) => {
        adjustedCalls.push({ video, speed, options });
      },
      resetSpeed: () => {},
      runAction: () => {},
    };

    window.VSC.stateManager = {
      getAllMediaElements: () => [controlledVideo, uncontrolledVideo],
    };

    localExtension.handleRuntimeMessage({
      type: window.VSC.Constants.MESSAGE_TYPES.SET_SPEED,
      payload: { speed: 1.75 },
    });

    assert.equal(adjustedCalls.length, 1, 'controlled media should use action handler');
    assert.equal(
      adjustedCalls[0].video,
      controlledVideo,
      'action handler should receive controlled video'
    );
    assert.equal(adjustedCalls[0].speed, 1.75, 'action handler should receive absolute speed');
    assert.equal(uncontrolledVideo.playbackRate, 1.75, 'uncontrolled media should update directly');
  }
);

runner.test('handleRuntimeMessage should post site info for popup requests', async () => {
  const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
  const localExtension = new VideoSpeedExtension();
  const originalPostMessage = window.postMessage;
  const postedMessages = [];
  const video = createMockVideo();

  localExtension.MESSAGE_TYPES = window.VSC.Constants.MESSAGE_TYPES;
  video.playbackRate = 1.5;

  window.VSC.stateManager = {
    getAllMediaElements: () => [video],
  };
  window.VSC.videoSpeedConfig = {
    settings: { lastSpeed: 1.25 },
    getSiteProfile: () => ({ speed: 1.5 }),
  };
  window.postMessage = (payload) => {
    postedMessages.push(payload);
  };

  try {
    localExtension.handleRuntimeMessage({
      type: window.VSC.Constants.MESSAGE_TYPES.GET_SITE_INFO,
    });

    assert.equal(postedMessages.length, 1, 'site info should be posted once');
    assert.equal(
      postedMessages[0].source,
      'vsc-page',
      'site info should be posted from page bridge'
    );
    assert.equal(
      postedMessages[0].action,
      'current-speed-response',
      'site info action should match bridge contract'
    );
    assert.equal(
      postedMessages[0].data.speed,
      1.5,
      'site info should report actual playback rate from video'
    );
    assert.equal(
      postedMessages[0].data.hasProfile,
      true,
      'site info should report existing profile'
    );
  } finally {
    window.postMessage = originalPostMessage;
  }
});

runner.test('handleRuntimeMessage GET_SITE_INFO should use max playback rate for multi-video', async () => {
  const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
  const localExtension = new VideoSpeedExtension();
  const originalPostMessage = window.postMessage;
  const postedMessages = [];
  const video1 = createMockVideo();
  const video2 = createMockVideo();

  localExtension.MESSAGE_TYPES = window.VSC.Constants.MESSAGE_TYPES;
  video1.playbackRate = 1.0;
  video2.playbackRate = 2.0;

  window.VSC.stateManager = {
    getAllMediaElements: () => [video1, video2],
  };
  window.VSC.videoSpeedConfig = {
    settings: { lastSpeed: 1.0 },
    getSiteProfile: () => null,
  };
  window.postMessage = (payload) => {
    postedMessages.push(payload);
  };

  try {
    localExtension.handleRuntimeMessage({
      type: window.VSC.Constants.MESSAGE_TYPES.GET_SITE_INFO,
    });

    assert.equal(postedMessages.length, 1, 'site info should be posted once');
    assert.equal(
      postedMessages[0].data.speed,
      2.0,
      'site info should use max playback rate among media'
    );
  } finally {
    window.postMessage = originalPostMessage;
  }
});

runner.test('attachControllersToMedia should skip duplicate and pending media attachments', () => {
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

  assert.equal(attachedCount, 1, 'only unattached media should be processed');
  assert.equal(attached.length, 1, 'onVideoFound should only run once');
  assert.equal(attached[0], freshVideo, 'fresh media should be attached');
});

runner.test('shouldRunComprehensiveScan should only allow one scan per document', () => {
  const VideoSpeedExtension = window.VSC.VideoSpeedExtension;
  const localExtension = new VideoSpeedExtension();

  assert.equal(localExtension.shouldRunComprehensiveScan(document), true);
  assert.equal(localExtension.shouldRunComprehensiveScan(document), false);
});

export { runner as injectTestRunner };
