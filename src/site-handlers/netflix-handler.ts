window.VSC = window.VSC || {};

class NetflixHandler extends window.VSC.BaseSiteHandler {
  static matches(): boolean {
    return location.hostname === 'www.netflix.com';
  }

  getControllerPosition(parent: HTMLElement, _video: HTMLElement) {
    return {
      insertionPoint: parent.parentElement,
      insertionMethod: 'beforeParent',
      targetParent: parent.parentElement,
    };
  }

  handleSeek(video: HTMLMediaElement, seekSeconds: number): boolean {
    try {
      window.postMessage(
        {
          action: 'videospeed-seek',
          seekMs: seekSeconds * 1000,
        },
        'https://www.netflix.com'
      );

      window.VSC.logger.debug(`Netflix seek: ${seekSeconds} seconds`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.VSC.logger.error(`Netflix seek failed: ${message}`);
      video.currentTime += seekSeconds;
      return true;
    }
  }

  initialize(document: Document): void {
    super.initialize(document);
    window.VSC.logger.debug(
      'Netflix handler initialized - script injection handled by content script'
    );
  }

  shouldIgnoreVideo(video: HTMLMediaElement): boolean {
    return (
      video.classList.contains('preview-video') ||
      video.parentElement?.classList.contains('billboard-row') ||
      false
    );
  }

  getVideoContainerSelectors(): string[] {
    return ['.watch-video', '.nfp-container', '#netflix-player'];
  }
}

window.VSC.NetflixHandler = NetflixHandler;
