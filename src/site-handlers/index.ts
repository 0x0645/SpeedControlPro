import { logger } from '../utils/logger';
import { BaseSiteHandler } from './base-handler';
import { NetflixHandler } from './netflix-handler';
import { YouTubeHandler } from './youtube-handler';
import { FacebookHandler } from './facebook-handler';
import { AmazonHandler } from './amazon-handler';
import { AppleHandler } from './apple-handler';

export class SiteHandlerManager {
  currentHandler: any = null;
  availableHandlers: any[];

  constructor() {
    this.availableHandlers = [
      NetflixHandler,
      YouTubeHandler,
      FacebookHandler,
      AmazonHandler,
      AppleHandler,
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
        logger.info(`Using ${HandlerClass.name} for ${location.hostname}`);
        return new HandlerClass();
      }
    }

    logger.debug(`Using BaseSiteHandler for ${location.hostname}`);
    return new BaseSiteHandler();
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

export const siteHandlerManager = new SiteHandlerManager();
