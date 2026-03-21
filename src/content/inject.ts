class VideoSpeedExtension {
  config: any = null;
  actionHandler: any = null;
  eventManager: any = null;
  mutationObserver: any = null;
  mediaObserver: any = null;
  initialized = false;
  pendingMediaControllers = new WeakSet<HTMLMediaElement>();
  scannedDocuments = new WeakSet<Document>();
  VideoController: any;
  ActionHandler: any;
  EventManager: any;
  logger: any;
  initializeWhenReady: any;
  siteHandlerManager: any;
  VideoMutationObserver: any;
  MediaElementObserver: any;
  MESSAGE_TYPES: any;

  bindGlobals(): void {
    this.VideoController = window.VSC.VideoController;
    this.ActionHandler = window.VSC.ActionHandler;
    this.EventManager = window.VSC.EventManager;
    this.logger = window.VSC.logger;
    this.initializeWhenReady = window.VSC.DomUtils.initializeWhenReady;
    this.siteHandlerManager = window.VSC.siteHandlerManager;
    this.VideoMutationObserver = window.VSC.VideoMutationObserver;
    this.MediaElementObserver = window.VSC.MediaElementObserver;
    this.MESSAGE_TYPES = window.VSC.Constants.MESSAGE_TYPES;
  }

  async loadConfig(): Promise<void> {
    this.config = window.VSC.videoSpeedConfig;
    await this.config.load();
  }

  initializeServices(): void {
    this.siteHandlerManager.initialize(document);
    this.eventManager = new this.EventManager(this.config, null);
    this.actionHandler = new this.ActionHandler(this.config, this.eventManager);
    this.eventManager.actionHandler = this.actionHandler;
    this.setupObservers();
  }

  getAllMediaElements(): HTMLMediaElement[] {
    return window.VSC.stateManager ? window.VSC.stateManager.getAllMediaElements() : [];
  }

  getStateManager(): any {
    return window.VSC.stateManager || null;
  }

  getCurrentSpeed(videos: HTMLMediaElement[]): number {
    if (videos.length > 0) {
      return videos[0].playbackRate;
    }
    return window.VSC.videoSpeedConfig?.settings?.lastSpeed || 1.0;
  }

  postSiteInfo(videos: HTMLMediaElement[]): void {
    const hostname = location.hostname;
    const profile = window.VSC.videoSpeedConfig?.getSiteProfile(hostname);

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
      if ((video as any).vsc) {
        this.actionHandler.adjustSpeed(video, targetSpeed);
      } else {
        video.playbackRate = targetSpeed;
      }
    });

    window.VSC.logger?.debug(`Set speed to ${targetSpeed} on ${videos.length} media elements`);
  }

  adjustRelativeSpeed(videos: HTMLMediaElement[], delta: number): void {
    this.forEachMedia(videos, (video) => {
      if ((video as any).vsc) {
        this.actionHandler.adjustSpeed(video, delta, { relative: true });
      } else {
        video.playbackRate = Math.min(Math.max(video.playbackRate + delta, 0.07), 16);
      }
    });

    window.VSC.logger?.debug(`Adjusted speed by ${delta} on ${videos.length} media elements`);
  }

  resetMediaSpeed(videos: HTMLMediaElement[]): void {
    this.forEachMedia(videos, (video) => {
      if ((video as any).vsc) {
        this.actionHandler.resetSpeed(video, 1.0);
      } else {
        video.playbackRate = 1.0;
      }
    });

    window.VSC.logger?.debug(`Reset speed on ${videos.length} media elements`);
  }

  handleRuntimeMessage(message: any): void {
    if (!(typeof message === 'object' && message.type && message.type.startsWith('VSC_'))) {
      return;
    }

    const videos = this.getAllMediaElements();

    switch (message.type) {
      case this.MESSAGE_TYPES.SET_SPEED:
        if (message.payload && typeof message.payload.speed === 'number') {
          this.setAbsoluteSpeed(videos, message.payload.speed);
        }
        break;
      case this.MESSAGE_TYPES.ADJUST_SPEED:
        if (message.payload && typeof message.payload.delta === 'number') {
          this.adjustRelativeSpeed(videos, message.payload.delta);
        }
        break;
      case this.MESSAGE_TYPES.RESET_SPEED:
        this.resetMediaSpeed(videos);
        break;
      case this.MESSAGE_TYPES.TOGGLE_DISPLAY:
        if (this.actionHandler) {
          this.actionHandler.runAction('display', null, null);
        }
        break;
      case this.MESSAGE_TYPES.GET_SITE_INFO:
        this.postSiteInfo(videos);
        break;
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
    const stateManager = this.getStateManager();
    return Boolean((video as any)?.vsc) || Boolean(stateManager?.hasMediaElement(video));
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
      (video as any).vsc = new this.VideoController(
        video,
        parent,
        this.config,
        this.actionHandler,
        shouldStartHidden
      );
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
      this.bindGlobals();
      this.logger.info('Video Speed Controller starting...');
      await this.loadConfig();
      this.initializeServices();

      this.initializeWhenReady(document, (doc: Document) => {
        this.initializeDocument(doc);
      });

      this.logger.info('Video Speed Controller initialized successfully');
      this.initialized = true;
    } catch (error) {
      const err = error as Error;
      console.error(`❌ Failed to initialize Video Speed Controller: ${err.message}`);
      console.error('📋 Full error details:', error);
      console.error('🔍 Error stack:', err.stack);
    }
  }

  initializeDocument(document: Document): void {
    try {
      if (window.VSC.initialized) {
        return;
      }

      window.VSC.initialized = true;
      this.applyDomainStyles(document);
      this.eventManager.setupEventListeners(document);
      if (document !== window.document) {
        this.setupDocumentCSS(document);
      }

      this.deferExpensiveOperations(document);
      this.logger.debug('Document initialization completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize document: ${message}`);
    }
  }

  deferExpensiveOperations(document: Document): void {
    const callback = () => {
      try {
        if (this.mutationObserver) {
          this.mutationObserver.start(document);
          this.logger.debug('Mutation observer started for document');
        }

        this.deferredMediaScan(document);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to complete deferred operations: ${message}`);
      }
    };

    this.scheduleIdleWork(callback, 2000, 100);
  }

  deferredMediaScan(document: Document): void {
    const performChunkedScan = () => {
      try {
        const lightMedia = this.mediaObserver.scanForMediaLight(document) as HTMLMediaElement[];
        const attachedCount = this.attachControllersToMedia(lightMedia);

        this.logger.info(`Attached controllers to ${attachedCount} media elements (light scan)`);

        if (attachedCount === 0 && this.shouldRunComprehensiveScan(document)) {
          this.scheduleComprehensiveScan(document);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to scan media elements: ${message}`);
      }
    };

    this.scheduleIdleWork(performChunkedScan, 3000, 200);
  }

  scheduleComprehensiveScan(document: Document): void {
    globalThis.setTimeout(() => {
      try {
        const comprehensiveMedia = this.mediaObserver.scanAll(document) as HTMLMediaElement[];
        const attachedCount = this.attachControllersToMedia(comprehensiveMedia);

        this.logger.info(`Comprehensive scan attached ${attachedCount} additional media elements`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed comprehensive media scan: ${message}`);
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
      this.logger.error(`Failed to apply domain styles: ${message}`);
    }
  }

  setupObservers(): void {
    this.mediaObserver = new this.MediaElementObserver(this.config, this.siteHandlerManager);
    this.mutationObserver = new this.VideoMutationObserver(
      this.config,
      (video: HTMLMediaElement, parent: Node | null) => this.onVideoFound(video, parent),
      (video: HTMLMediaElement) => this.onVideoRemoved(video),
      this.mediaObserver
    );
  }

  onVideoFound(video: HTMLMediaElement, parent: Node | null): void {
    try {
      if (this.mediaObserver && !this.mediaObserver.isValidMediaElement(video)) {
        this.logger.debug('Video element is not valid for controller attachment');
        return;
      }

      if ((video as any).vsc) {
        this.logger.debug('Video already has controller attached');
        return;
      }

      if (this.isPendingController(video)) {
        this.logger.debug('Video controller attachment already pending');
        return;
      }

      const shouldStartHidden = this.mediaObserver
        ? this.mediaObserver.shouldStartHidden(video)
        : false;
      this.logger.debug(
        'Attaching controller to new video element',
        shouldStartHidden ? '(starting hidden)' : ''
      );
      this.attachController(video, parent, shouldStartHidden);
    } catch (error) {
      this.clearPendingController(video);
      const err = error as Error;
      console.error('💥 Failed to attach controller to video:', error);
      this.logger.error(`Failed to attach controller to video: ${err.message}`);
    }
  }

  onVideoRemoved(video: HTMLMediaElement & { vsc?: any }): void {
    try {
      if (video.vsc) {
        this.logger.debug('Removing controller from video element');
        video.vsc.remove();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to remove video controller: ${message}`);
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
    this.logger.debug('CSS injected into iframe document');
  }
}

window.VSC = window.VSC || {};
window.VSC.VideoSpeedExtension = VideoSpeedExtension;

(function () {
  const extension = new VideoSpeedExtension();
  extension.registerMessageHandler();

  if (window.VSC_controller && window.VSC_controller.initialized) {
    window.VSC.logger?.info('VSC already initialized, skipping re-injection');
    return;
  }

  extension.initialize().catch((error: Error) => {
    console.error(`Extension initialization failed: ${error.message}`);
    window.VSC.logger.error(`Extension initialization failed: ${error.message}`);
  });

  window.VSC_controller = extension;
})();
