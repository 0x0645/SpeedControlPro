/**
 * Integration tests for VSCStateManager
 * Tests the complete flow: Controller creation → State tracking → Background sync
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockVideo, wait } from '../helpers/test-utils.js';
import { loadCoreModules } from '../helpers/module-loader.js';

// Load all required modules
await loadCoreModules();

/**
 * Mock postMessage to capture state manager communications
 */
function setupPostMessageMock() {
  const messages = [];
  const originalPostMessage = window.postMessage;

  window.postMessage = function (message, origin) {
    if (message && message.source === 'vsc-page' && message.action === 'runtime-message') {
      messages.push(message.data);
    }
    // Don't call original to avoid errors in test environment
  };

  return {
    messages,
    restore: () => {
      window.postMessage = originalPostMessage;
    },
  };
}

describe('State Manager Integration', () => {
  beforeEach(() => {
  });

  afterEach(() => {
  });

  it('StateManager registers and tracks controllers correctly', async () => {
    // Setup
    const mockMessage = setupPostMessageMock();
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    // Clear any existing state
    window.VSC.stateManager.__resetForTests();

    const actionHandler = new window.VSC.ActionHandler(config);
    const mockVideo1 = createMockVideo();
    mockVideo1.src = 'https://example.com/video1.mp4';
    mockVideo1.currentSrc = mockVideo1.src;

    const mockVideo2 = createMockVideo();
    mockVideo2.src = 'https://example.com/video2.mp4';
    mockVideo2.currentSrc = mockVideo2.src;

    // Create parent elements for DOM operations
    const parent1 = document.createElement('div');
    const parent2 = document.createElement('div');
    document.body.appendChild(parent1);
    document.body.appendChild(parent2);
    parent1.appendChild(mockVideo1);
    parent2.appendChild(mockVideo2);

    // Test: Creating first controller should trigger state update
    const controller1 = new window.VSC.VideoController(mockVideo1, parent1, config, actionHandler);
    await wait(40);

    // Verify controller is registered
    expect(window.VSC.stateManager.controllers.size).toBe(1);
    expect(window.VSC.stateManager.hasMediaElement(mockVideo1)).toBe(true);

    // Verify background notification was sent
    expect(mockMessage.messages.length > 0).toBe(true);
    const firstMessage = mockMessage.messages[mockMessage.messages.length - 1];
    expect(firstMessage.type).toBe('VSC_STATE_UPDATE');
    expect(firstMessage.hasActiveControllers).toBe(true);
    expect(firstMessage.controllerCount).toBe(1);

    // Test: Creating second controller
    const controller2 = new window.VSC.VideoController(mockVideo2, parent2, config, actionHandler);
    await wait(40);

    // Verify both controllers are tracked
    expect(window.VSC.stateManager.controllers.size).toBe(2);

    // Test: Removing first controller
    controller1.remove();
    await wait(40);

    // Verify controller was removed from state manager
    expect(window.VSC.stateManager.controllers.size).toBe(1);
    expect(window.VSC.stateManager.hasMediaElement(mockVideo1)).toBe(false);

    // Verify background was notified of change
    const removeMessage = mockMessage.messages[mockMessage.messages.length - 1];
    expect(removeMessage.controllerCount).toBe(1);

    // Test: Removing last controller
    controller2.remove();
    await wait(40);

    // Verify all controllers removed
    expect(window.VSC.stateManager.controllers.size).toBe(0);

    // Verify final notification
    const finalMessage = mockMessage.messages[mockMessage.messages.length - 1];
    expect(finalMessage.hasActiveControllers).toBe(false);
    expect(finalMessage.controllerCount).toBe(0);

    // Cleanup
    parent1.remove();
    parent2.remove();
    mockMessage.restore();
  });

  it('StateManager getAllMediaElements includes all tracked videos', async () => {
    // Setup
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    // Clear any existing state
    window.VSC.stateManager.__resetForTests();

    const actionHandler = new window.VSC.ActionHandler(config);
    const mockVideo1 = createMockVideo();
    const mockVideo2 = createMockVideo();

    // Create parent elements for DOM operations
    const parent1 = document.createElement('div');
    const parent2 = document.createElement('div');
    document.body.appendChild(parent1);
    document.body.appendChild(parent2);
    parent1.appendChild(mockVideo1);
    parent2.appendChild(mockVideo2);

    // Create controllers
    const controller1 = new window.VSC.VideoController(mockVideo1, parent1, config, actionHandler);
    const controller2 = new window.VSC.VideoController(mockVideo2, parent2, config, actionHandler);

    // Test: getAllMediaElements returns all tracked videos
    const allMedia = window.VSC.stateManager.getAllMediaElements();
    expect(allMedia.length).toBe(2);
    expect(allMedia.includes(mockVideo1)).toBe(true);
    expect(allMedia.includes(mockVideo2)).toBe(true);
    expect(window.VSC.stateManager.hasMediaElement(mockVideo1)).toBe(true);
    expect(window.VSC.stateManager.hasMediaElement(mockVideo2)).toBe(true);

    // Test: getControlledElements returns only videos with controllers
    const controlledMedia = window.VSC.stateManager.getControlledElements();
    expect(controlledMedia.length).toBe(2);
    expect(controlledMedia.every((v) => v.vsc)).toBe(true);

    // Cleanup
    controller1.remove();
    controller2.remove();
    parent1.remove();
    parent2.remove();
  });

  it('StateManager handles disconnected elements gracefully', async () => {
    // Setup
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    // Clear any existing state
    window.VSC.stateManager.__resetForTests();

    const actionHandler = new window.VSC.ActionHandler(config);
    const mockVideo = createMockVideo();

    // Create parent element for DOM operations
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    parent.appendChild(mockVideo);

    // Create controller
    const controller = new window.VSC.VideoController(mockVideo, parent, config, actionHandler);

    // Verify controller is tracked
    expect(window.VSC.stateManager.controllers.size).toBe(1);

    // Test: Remove video from DOM without calling controller.remove()
    parent.removeChild(mockVideo);

    // Call getAllMediaElements which should trigger cleanup
    const allMedia = window.VSC.stateManager.getAllMediaElements();

    // Verify stale reference was cleaned up
    expect(allMedia.length).toBe(0);
    expect(window.VSC.stateManager.controllers.size).toBe(0);
    expect(window.VSC.stateManager.hasMediaElement(mockVideo)).toBe(false);

    // No explicit cleanup needed since video is already removed from DOM
  });

  it('StateManager throttles background notifications', async () => {
    // Setup
    const mockMessage = setupPostMessageMock();
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    // Clear any existing state
    window.VSC.stateManager.__resetForTests();

    const actionHandler = new window.VSC.ActionHandler(config);

    // Create multiple controllers rapidly
    const videos = [];
    for (let i = 0; i < 5; i++) {
      const video = createMockVideo();
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      parent.appendChild(video);
      videos.push(video);
      new window.VSC.VideoController(video, parent, config, actionHandler);
    }

    await wait(40);

    // Verify notifications were emitted during rapid registration without exploding indefinitely
    expect(mockMessage.messages.length < 20).toBe(true);
    expect(mockMessage.messages.length > 0).toBe(true);

    // Verify final state is correct
    const finalMessage = mockMessage.messages[mockMessage.messages.length - 1];
    expect(finalMessage.controllerCount).toBe(5);

    // Cleanup
    videos.forEach((video) => {
      video.vsc?.remove();
      video.parentNode?.remove();
    });
    mockMessage.restore();
  });
});
