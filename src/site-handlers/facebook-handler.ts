import { logger } from '../utils/logger';
import { BaseSiteHandler } from './base-handler';

export class FacebookHandler extends BaseSiteHandler {
  facebookObserver: MutationObserver | null = null;

  static matches(): boolean {
    return location.hostname === 'www.facebook.com';
  }

  getControllerPosition(parent: HTMLElement, _video: HTMLElement) {
    let targetParent: any = parent;

    try {
      targetParent =
        parent.parentElement?.parentElement?.parentElement?.parentElement?.parentElement
          ?.parentElement?.parentElement || parent;
    } catch {
      logger.warn('Facebook DOM structure changed, using fallback positioning');
      targetParent = parent.parentElement;
    }

    return {
      insertionPoint: targetParent,
      insertionMethod: 'firstChild',
      targetParent,
    };
  }

  initialize(document: Document): void {
    super.initialize(document);
    this.setupFacebookObserver(document);
  }

  setupFacebookObserver(document: Document): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const videos =
                (node as Element).querySelectorAll && (node as Element).querySelectorAll('video');
              if (videos && videos.length > 0) {
                logger.debug(`Facebook: Found ${videos.length} new videos`);
                this.onNewVideosDetected(Array.from(videos) as HTMLMediaElement[]);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.facebookObserver = observer;
    logger.debug('Facebook dynamic content observer set up');
  }

  onNewVideosDetected(videos: HTMLMediaElement[]): void {
    logger.debug(`Facebook: ${videos.length} new videos detected`);
  }

  shouldIgnoreVideo(video: HTMLMediaElement): boolean {
    return (
      video.closest('[data-story-id]') !== null ||
      video.closest('.story-bucket-container') !== null ||
      video.getAttribute('data-video-width') === '0'
    );
  }

  getVideoContainerSelectors(): string[] {
    return ['[data-video-id]', '.video-container', '.fbStoryVideoContainer', '[role="main"] video'];
  }

  cleanup(): void {
    super.cleanup();

    if (this.facebookObserver) {
      this.facebookObserver.disconnect();
      this.facebookObserver = null;
    }
  }
}
