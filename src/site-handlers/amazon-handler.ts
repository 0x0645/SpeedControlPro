import { BaseSiteHandler } from './base-handler';

export class AmazonHandler extends BaseSiteHandler {
  static matches(): boolean {
    return (
      location.hostname === 'www.amazon.com' ||
      location.hostname === 'www.primevideo.com' ||
      location.hostname.includes('amazon.') ||
      location.hostname.includes('primevideo.')
    );
  }

  getControllerPosition(parent: HTMLElement, video: HTMLElement) {
    if (!(video as HTMLVideoElement).classList.contains('vjs-tech')) {
      return {
        insertionPoint: parent.parentElement,
        insertionMethod: 'beforeParent',
        targetParent: parent.parentElement,
      };
    }

    return super.getControllerPosition(parent, video);
  }

  shouldIgnoreVideo(video: HTMLMediaElement): boolean {
    if (video.readyState < 2) {
      return false;
    }

    const rect = video.getBoundingClientRect();
    return rect.width < 200 || rect.height < 100;
  }

  getVideoContainerSelectors(): string[] {
    return ['.dv-player-container', '.webPlayerContainer', '[data-testid="video-player"]'];
  }
}
