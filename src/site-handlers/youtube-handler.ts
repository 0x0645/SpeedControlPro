import { logger } from '../utils/logger';
import { BaseSiteHandler } from './base-handler';

export class YouTubeHandler extends BaseSiteHandler {
  static matches(): boolean {
    return location.hostname === 'www.youtube.com';
  }

  getControllerPosition(parent: HTMLElement, _video: HTMLElement) {
    const targetParent = parent.parentElement;
    return {
      insertionPoint: targetParent,
      insertionMethod: 'firstChild',
      targetParent,
    };
  }

  initialize(document: Document): void {
    super.initialize(document);
    this.setupYouTubeCSS();
  }

  setupYouTubeCSS(): void {
    logger.debug('YouTube CSS setup completed');
  }

  shouldIgnoreVideo(video: HTMLMediaElement): boolean {
    return (
      video.classList.contains('video-thumbnail') ||
      video.parentElement?.classList.contains('ytp-ad-player-overlay') ||
      false
    );
  }

  getVideoContainerSelectors(): string[] {
    return ['.html5-video-player', '#movie_player', '.ytp-player-content'];
  }

  detectSpecialVideos(document: Document | Element): HTMLMediaElement[] {
    const videos: HTMLMediaElement[] = [];

    try {
      const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
      iframes.forEach((iframe) => {
        try {
          const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
          if (iframeDoc) {
            const iframeVideos = iframeDoc.querySelectorAll('video');
            videos.push(...(Array.from(iframeVideos) as HTMLMediaElement[]));
          }
        } catch {
          // ignore cross-origin iframe
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`Could not access YouTube iframe videos: ${message}`);
    }

    return videos;
  }

  onPlayerStateChange(_video: HTMLMediaElement): void {
    logger.debug('YouTube player state changed');
  }
}
