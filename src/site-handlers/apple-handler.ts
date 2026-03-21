import { BaseSiteHandler } from './base-handler';

export class AppleHandler extends BaseSiteHandler {
  static matches(): boolean {
    return location.hostname === 'tv.apple.com';
  }

  getControllerPosition(parent: HTMLElement, _video: HTMLElement) {
    return {
      insertionPoint: parent.parentNode,
      insertionMethod: 'firstChild',
      targetParent: parent.parentNode,
    };
  }

  getVideoContainerSelectors(): string[] {
    return ['apple-tv-plus-player', '[data-testid="player"]', '.video-container'];
  }

  detectSpecialVideos(document: Document): HTMLMediaElement[] {
    const applePlayer = document.querySelector('apple-tv-plus-player') as Element & {
      shadowRoot?: ShadowRoot | null;
    };
    if (applePlayer && applePlayer.shadowRoot) {
      const videos = applePlayer.shadowRoot.querySelectorAll('video');
      return Array.from(videos) as HTMLMediaElement[];
    }
    return [];
  }
}
