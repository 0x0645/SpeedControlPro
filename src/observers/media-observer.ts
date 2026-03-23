import { findMediaElements, findShadowMedia } from '../utils/dom-utils';
import { logger } from '../utils/logger';
import type { IVideoSpeedConfig } from '../types/settings';
import type { SiteHandlerManager } from '../site-handlers/index';

export class MediaElementObserver {
  config: IVideoSpeedConfig;
  siteHandler: SiteHandlerManager;

  constructor(config: IVideoSpeedConfig, siteHandler: SiteHandlerManager) {
    this.config = config;
    this.siteHandler = siteHandler;
  }

  getMediaSelector(): string {
    return this.config.settings.audioBoolean ? 'video,audio' : 'video';
  }

  getUniqueMedia(mediaElements: HTMLMediaElement[]): HTMLMediaElement[] {
    return [...new Set(mediaElements)];
  }

  filterIgnoredMedia(mediaElements: HTMLMediaElement[]): HTMLMediaElement[] {
    return this.getUniqueMedia(mediaElements).filter((media) => {
      return !this.siteHandler.shouldIgnoreVideo(media);
    });
  }

  scanForMedia(document: Document | Element): HTMLMediaElement[] {
    const mediaTagSelector = this.getMediaSelector();
    const mediaElements = [
      ...findMediaElements(document, this.config.settings.audioBoolean),
      ...findShadowMedia(document, mediaTagSelector),
      ...this.siteHandler.detectSpecialVideos(document),
    ] as HTMLMediaElement[];
    const filteredMedia = this.filterIgnoredMedia(mediaElements);

    logger.info(
      `Found ${filteredMedia.length} media elements (${mediaElements.length} total, ${mediaElements.length - filteredMedia.length} filtered out)`
    );
    return filteredMedia;
  }

  scanForMediaLight(document: Document | Element): HTMLMediaElement[] {
    const mediaElements: HTMLMediaElement[] = [];
    const mediaTagSelector = this.getMediaSelector();

    try {
      const regularMedia = Array.from(
        document.querySelectorAll(mediaTagSelector)
      ) as HTMLMediaElement[];
      mediaElements.push(...regularMedia);

      const siteSpecificMedia = this.siteHandler.detectSpecialVideos(
        document
      ) as HTMLMediaElement[];
      mediaElements.push(...siteSpecificMedia);

      const filteredMedia = this.filterIgnoredMedia(mediaElements);

      logger.info(
        `Light scan found ${filteredMedia.length} media elements (${mediaElements.length} total, ${mediaElements.length - filteredMedia.length} filtered out)`
      );
      return filteredMedia;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Light media scan failed: ${message}`);
      return [];
    }
  }

  scanIframes(document: Document): HTMLMediaElement[] {
    const mediaElements: HTMLMediaElement[] = [];
    const frameTags = document.getElementsByTagName('iframe');

    Array.prototype.forEach.call(frameTags, (frame: HTMLIFrameElement) => {
      try {
        const childDocument = frame.contentDocument;
        if (childDocument) {
          const iframeMedia = this.scanForMedia(childDocument);
          mediaElements.push(...iframeMedia);
          logger.debug(`Found ${iframeMedia.length} media elements in iframe`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.debug(`Cannot access iframe content (cross-origin): ${message}`);
      }
    });

    return mediaElements;
  }

  scanSiteSpecificContainers(document: Document): HTMLMediaElement[] {
    const mediaElements: HTMLMediaElement[] = [];
    const containerSelectors = this.siteHandler.getVideoContainerSelectors();
    const audioEnabled = this.config.settings.audioBoolean;

    containerSelectors.forEach((selector: string) => {
      try {
        const containers = document.querySelectorAll(selector);
        containers.forEach((container) => {
          const containerMedia = findMediaElements(container, audioEnabled);
          mediaElements.push(...containerMedia);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Invalid selector "${selector}": ${message}`);
      }
    });

    return mediaElements;
  }

  scanAll(document: Document): HTMLMediaElement[] {
    const allMedia: HTMLMediaElement[] = [];
    allMedia.push(...this.scanForMedia(document));
    allMedia.push(...this.scanSiteSpecificContainers(document));
    allMedia.push(...this.scanIframes(document));

    const uniqueMedia = this.getUniqueMedia(allMedia);
    logger.info(`Total unique media elements found: ${uniqueMedia.length}`);
    return uniqueMedia;
  }

  isValidMediaElement(media: HTMLMediaElement): boolean {
    if (!media.isConnected) {
      logger.debug('Video not in DOM');
      return false;
    }

    if (media.tagName === 'AUDIO' && !this.config.settings.audioBoolean) {
      logger.debug('Audio element rejected - audioBoolean disabled');
      return false;
    }

    if (this.siteHandler.shouldIgnoreVideo(media)) {
      logger.debug('Video ignored by site handler');
      return false;
    }

    return true;
  }

  shouldStartHidden(media: HTMLMediaElement): boolean {
    if (media.tagName === 'AUDIO') {
      if (!this.config.settings.audioBoolean) {
        logger.debug('Audio controller hidden - audio support disabled');
        return true;
      }

      if (
        (media as HTMLMediaElement & { disabled?: boolean }).disabled ||
        media.style.pointerEvents === 'none'
      ) {
        logger.debug('Audio controller hidden - element disabled or no pointer events');
        return true;
      }

      logger.debug(
        'Audio controller will start visible (audio elements can be invisible but functional)'
      );
      return false;
    }

    const style = window.getComputedStyle(media);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      logger.debug('Video not visible, controller will start hidden');
      return true;
    }

    return false;
  }

  findControllerParent(media: HTMLMediaElement): HTMLElement | null {
    const positioning = this.siteHandler.getControllerPosition(media.parentElement!, media);
    return (positioning.targetParent as HTMLElement | null) || media.parentElement;
  }
}
