import type { VideoSpeedExtension } from '../content/inject';
import type { StorageSnapshot } from './contracts';
import type { VscAttachment } from './settings';

interface VscWindowNamespace {
  VideoSpeedExtension?: typeof VideoSpeedExtension;
  StorageManager?: import('../core/storage-manager').StorageManager & {
    __resetForTests?: () => void;
    _injectedSettings?: unknown;
  };
  logger?: { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  videoSpeedConfig?: InstanceType<import('../core/settings').VideoSpeedConfig> & {
    __resetForTests?: () => void;
  };
  VideoSpeedConfig?: import('../core/settings').VideoSpeedConfig;
  stateManager?: import('../core/state-manager').VSCStateManager;
  EventManager?: typeof import('../utils/event-manager').EventManager;
  ActionHandler?: typeof import('../core/action-handler').ActionHandler;
  VideoController?: typeof import('../core/video-controller').VideoController;
  VideoMutationObserver?: typeof import('../observers/mutation-observer').VideoMutationObserver;
  MediaElementObserver?: typeof import('../observers/media-observer').MediaElementObserver;
  BaseSiteHandler?: typeof import('../site-handlers/base-handler').BaseSiteHandler;
  siteHandlerManager?: {
    initialize(document: Document): void;
    getCurrentHandler(): unknown;
    getControllerPosition(
      parent: HTMLElement,
      video: HTMLElement
    ): import('../site-handlers/base-handler').ControllerPosition;
  };
  Constants?: typeof import('../utils/constants');
  DomUtils?: typeof import('../utils/dom-utils').DomUtils;
  [key: string]: unknown;
}

declare global {
  // Chrome extension APIs
  // eslint-disable-next-line no-var
  var chrome: typeof globalThis.chrome;

  interface Window {
    VSC: VscWindowNamespace;
    /** Page-level settings cache used by StorageManager in inject context */
    VSC_settings: StorageSnapshot | null;
    validationTimeout?: ReturnType<typeof setTimeout>;
    /** The active VideoSpeedExtension instance */
    VSC_controller: VideoSpeedExtension | null;
  }

  interface HTMLMediaElement {
    vsc?: VscAttachment;
  }
}

export {};
