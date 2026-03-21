window.VSC = window.VSC || {};

class SiteHandlerManager {
  currentHandler: any = null;
  availableHandlers: any[];

  constructor() {
    this.availableHandlers = [
      window.VSC.NetflixHandler,
      window.VSC.YouTubeHandler,
      window.VSC.FacebookHandler,
      window.VSC.AmazonHandler,
      window.VSC.AppleHandler,
    ];
  }

  getCurrentHandler(): any {
    if (!this.currentHandler) {
      this.currentHandler = this.detectHandler();
    }
    return this.currentHandler;
  }

  detectHandler(): any {
    for (const HandlerClass of this.availableHandlers) {
      if (HandlerClass.matches()) {
        window.VSC.logger.info(`Using ${HandlerClass.name} for ${location.hostname}`);
        return new HandlerClass();
      }
    }

    window.VSC.logger.debug(`Using BaseSiteHandler for ${location.hostname}`);
    return new window.VSC.BaseSiteHandler();
  }

  initialize(document: Document): void {
    this.getCurrentHandler().initialize(document);
  }

  getControllerPosition(parent: HTMLElement, video: HTMLElement) {
    return this.getCurrentHandler().getControllerPosition(parent, video);
  }

  handleSeek(video: HTMLMediaElement, seekSeconds: number): boolean {
    return this.getCurrentHandler().handleSeek(video, seekSeconds);
  }

  shouldIgnoreVideo(video: HTMLMediaElement): boolean {
    return this.getCurrentHandler().shouldIgnoreVideo(video);
  }

  getVideoContainerSelectors(): string[] {
    return this.getCurrentHandler().getVideoContainerSelectors();
  }

  detectSpecialVideos(document: Document): HTMLMediaElement[] {
    return this.getCurrentHandler().detectSpecialVideos(document);
  }

  cleanup(): void {
    if (this.currentHandler) {
      this.currentHandler.cleanup();
      this.currentHandler = null;
    }
  }

  refresh(): void {
    this.cleanup();
    this.currentHandler = null;
  }
}

window.VSC.siteHandlerManager = new SiteHandlerManager();
