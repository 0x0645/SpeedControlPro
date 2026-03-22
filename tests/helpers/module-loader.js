/**
 * Test module loader - loads all common dependencies for unit tests
 * This avoids the need for long import lists in individual test files
 */

import { JSDOM } from 'jsdom';

function ensureDomGlobals() {
  if (
    typeof global.window !== 'undefined' &&
    typeof global.document !== 'undefined' &&
    typeof global.HTMLElement !== 'undefined'
  ) {
    return;
  }

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Document: dom.window.Document,
    ShadowRoot: dom.window.ShadowRoot,
    CustomEvent: dom.window.CustomEvent,
    Event: dom.window.Event,
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    HTMLMediaElement: dom.window.HTMLMediaElement,
    HTMLVideoElement: dom.window.HTMLVideoElement,
    HTMLAudioElement: dom.window.HTMLAudioElement,
    customElements: dom.window.customElements,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  });

  dom.window.VSC = dom.window.VSC || {};
  global.__moduleLoaderDom = dom;
}

/**
 * Register imported modules on window.VSC so tests can access them
 * as globals (matching the bundled IIFE extension pattern).
 */
function registerOnVSC(modules) {
  const win = typeof window !== 'undefined' ? window : global.window;
  if (!win) return;
  win.VSC = win.VSC || {};
  for (const [name, value] of Object.entries(modules)) {
    win.VSC[name] = value;
  }
}

/**
 * Load all core modules required for most tests
 * This mimics the global module loading pattern used in the extension
 */
export async function loadCoreModules() {
  ensureDomGlobals();

  // Core utilities (order matters due to dependencies)
  const constants = await import('../../src/utils/constants.ts');
  const loggerMod = await import('../../src/utils/logger.ts');
  const domUtils = await import('../../src/utils/dom-utils.ts');
  const eventManagerMod = await import('../../src/utils/event-manager.ts');

  // Storage and settings
  const storageManagerMod = await import('../../src/core/storage-manager.ts');
  const settingsMod = await import('../../src/core/settings.ts');

  // State management
  const stateManagerMod = await import('../../src/core/state-manager.ts');

  // Site handlers
  const baseHandler = await import('../../src/site-handlers/base-handler.ts');
  await import('../../src/site-handlers/netflix-handler.ts');
  await import('../../src/site-handlers/youtube-handler.ts');
  await import('../../src/site-handlers/facebook-handler.ts');
  await import('../../src/site-handlers/amazon-handler.ts');
  await import('../../src/site-handlers/apple-handler.ts');
  const siteHandlersMod = await import('../../src/site-handlers/index.ts');

  // Core controllers
  const actionHandlerMod = await import('../../src/core/action-handler.ts');
  const videoControllerMod = await import('../../src/core/video-controller.ts');

  // UI components
  await import('../../src/ui/controls.ts');
  await import('../../src/ui/drag-handler.ts');
  await import('../../src/ui/shadow-dom.ts');
  await import('../../src/ui/vsc-controller-element.ts');

  // Observers
  const mutationObserverMod = await import('../../src/observers/mutation-observer.ts');
  const mediaObserverMod = await import('../../src/observers/media-observer.ts');

  // Register all modules on window.VSC for test access
  registerOnVSC({
    Constants: constants,
    DEFAULT_SETTINGS: constants.DEFAULT_SETTINGS,
    SPEED_LIMITS: constants.SPEED_LIMITS,
    logger: loggerMod.logger,
    DomUtils: domUtils,
    EventManager: eventManagerMod.EventManager,
    StorageManager: storageManagerMod.StorageManager,
    VideoSpeedConfig: settingsMod.VideoSpeedConfig,
    videoSpeedConfig: settingsMod.videoSpeedConfig,
    stateManager: stateManagerMod.stateManager,
    BaseSiteHandler: baseHandler.BaseSiteHandler,
    siteHandlerManager: siteHandlersMod.siteHandlerManager,
    ActionHandler: actionHandlerMod.ActionHandler,
    VideoController: videoControllerMod.VideoController,
    VideoMutationObserver: mutationObserverMod.VideoMutationObserver,
    MediaElementObserver: mediaObserverMod.MediaElementObserver,
  });
}

/**
 * Load injection script modules (includes core modules + inject.js)
 */
export async function loadInjectModules() {
  await loadCoreModules();
  const injectMod = await import('../../src/content/inject.ts');
  registerOnVSC({
    VideoSpeedExtension: injectMod.VideoSpeedExtension,
  });
}

/**
 * Load minimal modules for lightweight tests
 */
export async function loadMinimalModules() {
  ensureDomGlobals();

  const constants = await import('../../src/utils/constants.ts');
  const loggerMod = await import('../../src/utils/logger.ts');
  const storageManagerMod = await import('../../src/core/storage-manager.ts');
  const settingsMod = await import('../../src/core/settings.ts');

  registerOnVSC({
    Constants: constants,
    DEFAULT_SETTINGS: constants.DEFAULT_SETTINGS,
    logger: loggerMod.logger,
    StorageManager: storageManagerMod.StorageManager,
    VideoSpeedConfig: settingsMod.VideoSpeedConfig,
    videoSpeedConfig: settingsMod.videoSpeedConfig,
  });
}

/**
 * Load observer modules for observer tests
 */
export async function loadObserverModules() {
  ensureDomGlobals();

  const loggerMod = await import('../../src/utils/logger.ts');
  const domUtils = await import('../../src/utils/dom-utils.ts');
  const mutationObserverMod = await import('../../src/observers/mutation-observer.ts');

  registerOnVSC({
    logger: loggerMod.logger,
    DomUtils: domUtils,
    VideoMutationObserver: mutationObserverMod.VideoMutationObserver,
  });
}
