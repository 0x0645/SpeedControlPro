window.VSC = window.VSC || {};

export type ControllerPosition = {
  insertionPoint: any;
  insertionMethod: 'firstChild' | 'beforeParent' | 'afterParent';
  targetParent: any;
};

class BaseSiteHandler {
  hostname: string;

  constructor() {
    this.hostname = location.hostname;
  }

  static matches(): boolean {
    return false;
  }

  getControllerPosition(parent: HTMLElement, _video: HTMLElement): ControllerPosition {
    return {
      insertionPoint: parent,
      insertionMethod: 'firstChild',
      targetParent: parent,
    };
  }

  handleSeek(video: HTMLMediaElement, seekSeconds: number): boolean {
    if (video.currentTime !== undefined && video.duration) {
      const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekSeconds));
      video.currentTime = newTime;
    } else {
      video.currentTime += seekSeconds;
    }
    return true;
  }

  initialize(_document: Document): void {
    window.VSC.logger.debug(`Initializing ${this.constructor.name} for ${this.hostname}`);
  }

  cleanup(): void {
    window.VSC.logger.debug(`Cleaning up ${this.constructor.name}`);
  }

  shouldIgnoreVideo(_video: HTMLMediaElement): boolean {
    return false;
  }

  getVideoContainerSelectors(): string[] {
    return [];
  }

  detectSpecialVideos(_document: Document): HTMLMediaElement[] {
    return [];
  }
}

window.VSC.BaseSiteHandler = BaseSiteHandler;
