import { VideoController } from '../core/video-controller';
import { ActionHandler } from '../core/action-handler';
import { EventManager } from '../utils/event-manager';
import { logger } from '../utils/logger';
import { MESSAGE_TYPES } from '../utils/message-types';
import { initializeWhenReady } from '../utils/dom-utils';
import { siteHandlerManager } from '../site-handlers/index';
import { VideoMutationObserver } from '../observers/mutation-observer';
import { MediaElementObserver } from '../observers/media-observer';
import { videoSpeedConfig } from '../core/settings';
import { stateManager } from '../core/state-manager';
import type { VscMedia, VscAttachment } from '../types/settings';

let moduleInitialized = false;

class VideoSpeedExtension {
  config = videoSpeedConfig;
  actionHandler: InstanceType<typeof ActionHandler> | null = null;
  eventManager: InstanceType<typeof EventManager> | null = null;
  mutationObserver: InstanceType<typeof VideoMutationObserver> | null = null;
  mediaObserver: InstanceType<typeof MediaElementObserver> | null = null;
  initialized = false;
  pendingMediaControllers = new WeakSet<HTMLMediaElement>();
  scannedDocuments = new WeakSet<Document>();

  async loadConfig(): Promise<void> {
    await this.config.load();
  }

  initializeServices(): void {
    siteHandlerManager.initialize(document);
    this.eventManager = new EventManager(this.config, null);
    this.actionHandler = new ActionHandler(this.config, this.eventManager);
    this.eventManager.actionHandler = this.actionHandler;
    this.setupObservers();
  }

  getAllMediaElements(): HTMLMediaElement[] {
    return stateManager.getAllMediaElements();
  }

  getMediaForSpeedRead(): HTMLMediaElement[] {
    const controlled = this.getAllMediaElements();
    if (controlled.length > 0) {
      return controlled;
    }
    const fallback: HTMLMediaElement[] = [];
    const media = document.querySelectorAll('video, audio');
    media.forEach((el) => {
      if (el instanceof HTMLMediaElement && el.isConnected) {
        fallback.push(el);
      }
    });
    return fallback;
  }

  getRepresentativePlaybackRate(videos: HTMLMediaElement[]): number {
    if (videos.length === 0) {
      return videoSpeedConfig.settings?.lastSpeed || 1.0;
    }
    const playing = videos.filter((v) => !v.paused);
    const candidates = playing.length > 0 ? playing : videos;
    const rates = candidates.map((v) => v.playbackRate).filter((r) => r >= 0.07);
    if (rates.length === 0) {
      return videoSpeedConfig.settings?.lastSpeed || 1.0;
    }
    return Math.max(...rates);
  }

  getCurrentSpeed(videos: HTMLMediaElement[]): number {
    return this.getRepresentativePlaybackRate(videos);
  }

  postSiteInfo(videos: HTMLMediaElement[]): void {
    const hostname = location.hostname;
    const profile = videoSpeedConfig.getSiteProfile(hostname);

    window.postMessage(
      {
        source: 'vsc-page',
        action: 'current-speed-response',
        data: {
          speed: this.getCurrentSpeed(videos),
          hostname,
          hasProfile: profile !== null,
          profile,
        },
      },
      '*'
    );
  }

  forEachMedia(videos: HTMLMediaElement[], callback: (video: HTMLMediaElement) => void): void {
    videos.forEach((video) => {
      callback(video);
    });
  }

  setAbsoluteSpeed(videos: HTMLMediaElement[], targetSpeed: number): void {
    this.forEachMedia(videos, (video) => {
      if ((video as VscMedia).vsc) {
        this.actionHandler!.adjustSpeed(video, targetSpeed);
      } else {
        video.playbackRate = targetSpeed;
      }
    });

    logger.debug(`Set speed to ${targetSpeed} on ${videos.length} media elements`);
  }

  adjustRelativeSpeed(videos: HTMLMediaElement[], delta: number): void {
    this.forEachMedia(videos, (video) => {
      if ((video as VscMedia).vsc) {
        this.actionHandler!.adjustSpeed(video, delta, { relative: true });
      } else {
        video.playbackRate = Math.min(Math.max(video.playbackRate + delta, 0.07), 16);
      }
    });

    logger.debug(`Adjusted speed by ${delta} on ${videos.length} media elements`);
  }

  resetMediaSpeed(videos: HTMLMediaElement[]): void {
    this.forEachMedia(videos, (video) => {
      if ((video as VscMedia).vsc) {
        this.actionHandler!.resetSpeed(video, 1.0);
      } else {
        video.playbackRate = 1.0;
      }
    });

    logger.debug(`Reset speed on ${videos.length} media elements`);
  }

  handleRuntimeMessage(message: { type?: string; payload?: { speed?: number; delta?: number } }): void {
    if (!(typeof message === 'object' && message.type && message.type.startsWith('VSC_'))) {
      return;
    }

    const videos = this.getAllMediaElements();

    switch (message.type) {
      case MESSAGE_TYPES.SET_SPEED:
        if (message.payload && typeof message.payload.speed === 'number') {
          this.setAbsoluteSpeed(videos, message.payload.speed);
        }
        break;
      case MESSAGE_TYPES.ADJUST_SPEED:
        if (message.payload && typeof message.payload.delta === 'number') {
          this.adjustRelativeSpeed(videos, message.payload.delta);
        }
        break;
      case MESSAGE_TYPES.RESET_SPEED:
        this.resetMediaSpeed(videos);
        break;
      case MESSAGE_TYPES.TOGGLE_DISPLAY:
        if (this.actionHandler) {
          this.actionHandler.runAction('display', 0, null);
        }
        break;
      case MESSAGE_TYPES.GET_SITE_INFO: {
        const mediaForRead = this.getMediaForSpeedRead();
        this.postSiteInfo(mediaForRead);
        break;
      }
    }
  }

  registerMessageHandler(): void {
    window.addEventListener('VSC_MESSAGE', (event: Event) => {
      this.handleRuntimeMessage((event as CustomEvent).detail);
    });
  }

  scheduleIdleWork(callback: () => void, idleTimeout: number, fallbackDelay: number): void {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(callback, { timeout: idleTimeout });
    } else {
      globalThis.setTimeout(callback, fallbackDelay);
    }
  }

  hasActiveController(video: HTMLMediaElement): boolean {
    return Boolean((video as VscMedia)?.vsc) || Boolean(stateManager.hasMediaElement(video));
  }

  isPendingController(video: HTMLMediaElement): boolean {
    return this.pendingMediaControllers.has(video);
  }

  markControllerPending(video: HTMLMediaElement): void {
    this.pendingMediaControllers.add(video);
  }

  clearPendingController(video: HTMLMediaElement): void {
    this.pendingMediaControllers.delete(video);
  }

  shouldAttachController(video: HTMLMediaElement): boolean {
    return !this.hasActiveController(video) && !this.isPendingController(video);
  }

  attachController(video: HTMLMediaElement, parent: Node | null, shouldStartHidden: boolean): void {
    this.markControllerPending(video);

    try {
      (video as VscMedia).vsc = new VideoController(
        video,
        parent as HTMLElement | null,
        this.config,
        this.actionHandler!,
        shouldStartHidden
      ) as unknown as VscAttachment;
    } finally {
      this.clearPendingController(video);
    }
  }

  attachControllersToMedia(mediaElements: HTMLMediaElement[]): number {
    let attachedCount = 0;

    mediaElements.forEach((media) => {
      if (!this.shouldAttachController(media)) {
        return;
      }

      this.onVideoFound(media, media.parentElement || media.parentNode);

      if (this.hasActiveController(media)) {
        attachedCount += 1;
      }
    });

    return attachedCount;
  }

  shouldRunComprehensiveScan(document: Document): boolean {
    if (this.scannedDocuments.has(document)) {
      return false;
    }

    this.scannedDocuments.add(document);
    return true;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Video Speed Controller starting...');
      await this.loadConfig();
      this.initializeServices();

      initializeWhenReady(document, (doc: Document) => {
        this.initializeDocument(doc);
      });

      logger.info('Video Speed Controller initialized successfully');
      this.initialized = true;
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to initialize Video Speed Controller: ${err.message}`);
      console.error('Full error details:', error);
      console.error('Error stack:', err.stack);
    }
  }

  initializeDocument(document: Document): void {
    try {
      if (moduleInitialized) {
        return;
      }

      moduleInitialized = true;
      this.applyDomainStyles(document);
      this.eventManager!.setupEventListeners(document);
      if (document !== window.document) {
        this.setupDocumentCSS(document);
      }

      this.deferExpensiveOperations(document);
      logger.debug('Document initialization completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize document: ${message}`);
    }
  }

  deferExpensiveOperations(document: Document): void {
    const callback = () => {
      try {
        if (this.mutationObserver) {
          this.mutationObserver.start(document);
          logger.debug('Mutation observer started for document');
        }

        this.deferredMediaScan(document);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to complete deferred operations: ${message}`);
      }
    };

    this.scheduleIdleWork(callback, 2000, 100);
  }

  deferredMediaScan(document: Document): void {
    const performChunkedScan = () => {
      try {
        const lightMedia = this.mediaObserver!.scanForMediaLight(document) as HTMLMediaElement[];
        const attachedCount = this.attachControllersToMedia(lightMedia);

        logger.info(`Attached controllers to ${attachedCount} media elements (light scan)`);

        if (attachedCount === 0 && this.shouldRunComprehensiveScan(document)) {
          this.scheduleComprehensiveScan(document);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to scan media elements: ${message}`);
      }
    };

    this.scheduleIdleWork(performChunkedScan, 3000, 200);
  }

  scheduleComprehensiveScan(document: Document): void {
    globalThis.setTimeout(() => {
      try {
        const comprehensiveMedia = this.mediaObserver!.scanAll(document) as HTMLMediaElement[];
        const attachedCount = this.attachControllersToMedia(comprehensiveMedia);

        logger.info(`Comprehensive scan attached ${attachedCount} additional media elements`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed comprehensive media scan: ${message}`);
      }
    }, 1000);
  }

  applyDomainStyles(document: Document): void {
    try {
      const hostname = window.location.hostname;
      if (document.documentElement) {
        document.documentElement.style.setProperty('--vsc-domain', `"${hostname}"`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to apply domain styles: ${message}`);
    }
  }

  setupObservers(): void {
    this.mediaObserver = new MediaElementObserver(this.config, siteHandlerManager);
    this.mutationObserver = new VideoMutationObserver(
      this.config,
      (video: HTMLMediaElement, parent: Node | null) => this.onVideoFound(video, parent),
      (video: HTMLMediaElement) => this.onVideoRemoved(video),
      this.mediaObserver
    );
  }

  onVideoFound(video: HTMLMediaElement, parent: Node | null): void {
    try {
      if (this.mediaObserver && !this.mediaObserver.isValidMediaElement(video)) {
        logger.debug('Video element is not valid for controller attachment');
        return;
      }

      if ((video as VscMedia).vsc) {
        logger.debug('Video already has controller attached');
        return;
      }

      if (this.isPendingController(video)) {
        logger.debug('Video controller attachment already pending');
        return;
      }

      const shouldStartHidden = this.mediaObserver
        ? this.mediaObserver.shouldStartHidden(video)
        : false;
      logger.debug(
        `Attaching controller to new video element${shouldStartHidden ? ' (starting hidden)' : ''}`
      );
      this.attachController(video, parent, shouldStartHidden);
    } catch (error) {
      this.clearPendingController(video);
      const err = error as Error;
      console.error('Failed to attach controller to video:', error);
      logger.error(`Failed to attach controller to video: ${err.message}`);
    }
  }

  onVideoRemoved(video: VscMedia): void {
    try {
      if (video.vsc) {
        logger.debug('Removing controller from video element');
        video.vsc.remove?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to remove video controller: ${message}`);
    }
  }

  setupDocumentCSS(document: Document): void {
    const link = document.createElement('link');
    link.href =
      typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime
        ? globalThis.chrome.runtime.getURL('src/styles/inject.css')
        : '/src/styles/inject.css';
    link.type = 'text/css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    logger.debug('CSS injected into iframe document');
  }
}

export { VideoSpeedExtension };

(function () {
  const extension = new VideoSpeedExtension();
  extension.registerMessageHandler();

  if (window.VSC_controller && window.VSC_controller.initialized) {
    logger.info('VSC already initialized, skipping re-injection');
    return;
  }

  extension.initialize().catch((error: Error) => {
    console.error(`Extension initialization failed: ${error.message}`);
    logger.error(`Extension initialization failed: ${error.message}`);
  });

  window.VSC_controller = extension;
})();
