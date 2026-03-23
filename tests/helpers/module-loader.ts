import { JSDOM } from 'jsdom';

declare global {
  // eslint-disable-next-line no-var
  var __moduleLoaderDom: JSDOM | undefined;
}

function ensureDomGlobals(): void {
  const g = globalThis as typeof globalThis & {
    window?: Window;
    document?: Document;
    HTMLElement?: typeof HTMLElement;
    __moduleLoaderDom?: JSDOM;
  };

  if (
    typeof g.window !== 'undefined' &&
    typeof g.document !== 'undefined' &&
    typeof g.HTMLElement !== 'undefined'
  ) {
    return;
  }

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  Object.assign(g, {
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
  g.__moduleLoaderDom = dom;
}

function registerOnVSC(modules: Record<string, unknown>): void {
  const win =
    typeof window !== 'undefined'
      ? window
      : (globalThis as typeof globalThis & { window?: Window }).window;
  if (!win) {
    return;
  }
  win.VSC = win.VSC || {};
  for (const [name, value] of Object.entries(modules)) {
    (win.VSC as Record<string, unknown>)[name] = value;
  }
}

export async function loadCoreModules(): Promise<void> {
  ensureDomGlobals();

  const constants = await import('../../src/utils/constants');
  const loggerMod = await import('../../src/utils/logger');
  const domUtils = await import('../../src/utils/dom-utils');
  const eventManagerMod = await import('../../src/utils/event-manager');

  const storageManagerMod = await import('../../src/core/storage-manager');
  const settingsMod = await import('../../src/core/settings');

  const stateManagerMod = await import('../../src/core/state-manager');

  const baseHandler = await import('../../src/site-handlers/base-handler');
  await import('../../src/site-handlers/netflix-handler');
  await import('../../src/site-handlers/youtube-handler');
  await import('../../src/site-handlers/facebook-handler');
  await import('../../src/site-handlers/amazon-handler');
  await import('../../src/site-handlers/apple-handler');
  const siteHandlersMod = await import('../../src/site-handlers/index');

  const actionHandlerMod = await import('../../src/core/action-handler');
  const videoControllerMod = await import('../../src/core/video-controller');

  await import('../../src/ui/controls');
  await import('../../src/ui/drag-handler');
  await import('../../src/ui/shadow-dom');
  await import('../../src/ui/vsc-controller-element');

  const mutationObserverMod = await import('../../src/observers/mutation-observer');
  const mediaObserverMod = await import('../../src/observers/media-observer');

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

export async function loadInjectModules(): Promise<void> {
  await loadCoreModules();
  const injectMod = await import('../../src/content/inject');
  registerOnVSC({
    VideoSpeedExtension: injectMod.VideoSpeedExtension,
  });
}

export async function loadMinimalModules(): Promise<void> {
  ensureDomGlobals();

  const constants = await import('../../src/utils/constants');
  const loggerMod = await import('../../src/utils/logger');
  const storageManagerMod = await import('../../src/core/storage-manager');
  const settingsMod = await import('../../src/core/settings');

  registerOnVSC({
    Constants: constants,
    DEFAULT_SETTINGS: constants.DEFAULT_SETTINGS,
    logger: loggerMod.logger,
    StorageManager: storageManagerMod.StorageManager,
    VideoSpeedConfig: settingsMod.VideoSpeedConfig,
    videoSpeedConfig: settingsMod.videoSpeedConfig,
  });
}

export async function loadObserverModules(): Promise<void> {
  ensureDomGlobals();

  const loggerMod = await import('../../src/utils/logger');
  const domUtils = await import('../../src/utils/dom-utils');
  const mutationObserverMod = await import('../../src/observers/mutation-observer');

  registerOnVSC({
    logger: loggerMod.logger,
    DomUtils: domUtils,
    VideoMutationObserver: mutationObserverMod.VideoMutationObserver,
  });
}
