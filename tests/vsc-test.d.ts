declare global {
  interface VscWindowNamespace {
    StorageManager?: import('../src/core/storage-manager').StorageManager & {
      __resetForTests?: () => void;
      _injectedSettings?: unknown;
    };
    logger?: { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
    videoSpeedConfig?: InstanceType<import('../src/core/settings').VideoSpeedConfig> & {
      __resetForTests?: () => void;
    };
    VideoSpeedConfig?: import('../src/core/settings').VideoSpeedConfig;
    stateManager?: import('../src/core/state-manager').VSCStateManager;
    EventManager?: typeof import('../src/utils/event-manager').EventManager;
    ActionHandler?: typeof import('../src/core/action-handler').ActionHandler;
    VideoController?: typeof import('../src/core/video-controller').VideoController;
    VideoMutationObserver?: typeof import('../src/observers/mutation-observer').VideoMutationObserver;
    MediaElementObserver?: typeof import('../src/observers/media-observer').MediaElementObserver;
    BaseSiteHandler?: typeof import('../src/site-handlers/base-handler').BaseSiteHandler;
    siteHandlerManager?: InstanceType<
      typeof import('../src/site-handlers/index').SiteHandlerManager
    >;
    VideoSpeedExtension?: typeof import('../src/content/inject').VideoSpeedExtension;
    Constants?: typeof import('../src/utils/constants');
    DomUtils?: typeof import('../src/utils/dom-utils').DomUtils;
  }
}

export {};
