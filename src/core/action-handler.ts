import {
  getControlledMedia,
  getTargetControllerFromEvent,
  shouldSkipMediaForEvent,
  showControllerForMedia,
  toggleControllerDisplay,
} from './action-handler/controller-actions';
import {
  isValidSpeedChange,
  calculateTargetSpeed,
  clampSpeed,
  resolveForcedSpeed,
} from './action-handler/speed-actions';
import {
  seek,
  pause,
  resetSpeed,
  muted,
  volumeUp,
  volumeDown,
  setMark,
  jumpToMark,
  blinkController,
} from './action-handler/playback-actions';
import { logger } from '../utils/logger';
import { DragHandler } from '../ui/drag-handler';

type VscMedia = HTMLMediaElement & {
  vsc?: {
    div?: HTMLElement;
    speedIndicator?: { textContent: string };
  };
};

export class ActionHandler {
  config: any;
  eventManager: any;

  constructor(config: any, eventManager: any) {
    this.config = config;
    this.eventManager = eventManager;
  }

  getControlledMedia(): HTMLMediaElement[] {
    return getControlledMedia();
  }

  getTargetControllerFromEvent(e?: Event | null): HTMLElement | null {
    return getTargetControllerFromEvent(e);
  }

  shouldSkipMediaForEvent(
    video: VscMedia,
    targetController: HTMLElement | null,
    e?: Event | null
  ): boolean {
    return shouldSkipMediaForEvent(video, targetController, e);
  }

  showControllerForMedia(video: VscMedia): void {
    showControllerForMedia(video, this.eventManager);
  }

  toggleControllerDisplay(video: VscMedia): void {
    toggleControllerDisplay(video, this.eventManager);
  }

  isValidSpeedChange(video: VscMedia, value: unknown): boolean {
    return isValidSpeedChange(video, value);
  }

  calculateTargetSpeed(video: HTMLMediaElement, value: number, relative?: boolean): number {
    return calculateTargetSpeed(video, value, relative);
  }

  clampSpeed(targetSpeed: number): number {
    return clampSpeed(targetSpeed);
  }

  resolveForcedSpeed(targetSpeed: number, source: string): number {
    return resolveForcedSpeed(targetSpeed, source, this.config);
  }

  runAction(action: string, value: any, e?: Event | null): void {
    const mediaTags = this.getControlledMedia() as VscMedia[];
    const targetController = this.getTargetControllerFromEvent(e);

    mediaTags.forEach((video) => {
      if (this.shouldSkipMediaForEvent(video, targetController, e)) {
        return;
      }

      this.showControllerForMedia(video);
      this.executeAction(action, value, video, e);
    });
  }

  executeAction(action: string, value: any, video: VscMedia, e?: Event | null): void {
    switch (action) {
      case 'rewind':
        logger.debug('Rewind');
        this.seek(video, -value);
        break;
      case 'advance':
        logger.debug('Fast forward');
        this.seek(video, value);
        break;
      case 'faster':
        logger.debug('Increase speed');
        this.adjustSpeed(video, value, { relative: true });
        break;
      case 'slower':
        logger.debug('Decrease speed');
        this.adjustSpeed(video, -value, { relative: true });
        break;
      case 'reset':
        logger.debug('Reset speed');
        this.resetSpeed(video, value);
        break;
      case 'display':
        this.toggleControllerDisplay(video);
        break;
      case 'blink':
        logger.debug('Showing controller momentarily');
        this.blinkController(video.vsc!.div!, value);
        break;
      case 'drag':
        DragHandler.handleDrag(video, e);
        break;
      case 'fast':
        this.resetSpeed(video, value);
        break;
      case 'pause':
        this.pause(video);
        break;
      case 'muted':
        this.muted(video);
        break;
      case 'louder':
        this.volumeUp(video, value);
        break;
      case 'softer':
        this.volumeDown(video, value);
        break;
      case 'mark':
        this.setMark(video);
        break;
      case 'jump':
        this.jumpToMark(video);
        break;
      case 'SET_SPEED':
        logger.info('Setting speed to:', value);
        this.adjustSpeed(video, value, { source: 'internal' });
        break;
      case 'ADJUST_SPEED':
        logger.info('Adjusting speed by:', value);
        this.adjustSpeed(video, value, { relative: true, source: 'internal' });
        break;
      case 'RESET_SPEED': {
        logger.info('Resetting speed');
        const preferredSpeed = this.config.getKeyBinding('fast') || 1.0;
        this.adjustSpeed(video, preferredSpeed, { source: 'internal' });
        break;
      }
      default:
        logger.warn(`Unknown action: ${action}`);
    }
  }

  seek(video: HTMLMediaElement, seekSeconds: number): void {
    seek(video, seekSeconds);
  }

  pause(video: HTMLMediaElement): void {
    pause(video);
  }

  resetSpeed(video: VscMedia, target: number): void {
    resetSpeed(video, target, this, this.eventManager);
  }

  muted(video: HTMLMediaElement): void {
    muted(video);
  }

  volumeUp(video: HTMLMediaElement, value: number): void {
    volumeUp(video, value);
  }

  volumeDown(video: HTMLMediaElement, value: number): void {
    volumeDown(video, value);
  }

  setMark(video: VscMedia): void {
    setMark(video);
  }

  jumpToMark(video: VscMedia): void {
    jumpToMark(video);
  }

  blinkController(controller: HTMLElement, duration?: number): void {
    blinkController(controller as HTMLElement & { blinkTimeOut?: number }, duration);
  }

  adjustSpeed(
    video: VscMedia,
    value: number,
    options: { relative?: boolean; source?: string } = {}
  ): any {
    return logger.withContext(video, () => {
      const { relative = false, source = 'internal' } = options;

      logger.debug(
        `adjustSpeed called: value=${value}, relative=${relative}, source=${source}`
      );
      const stack = new Error().stack || '';
      const stackLines = stack.split('\n').slice(1, 8);
      logger.debug(`adjustSpeed call stack: ${stackLines.join(' -> ')}`);

      if (!this.isValidSpeedChange(video, value)) {
        return;
      }

      return this._adjustSpeedInternal(video, value, options);
    });
  }

  _adjustSpeedInternal(
    video: VscMedia,
    value: number,
    options: { relative?: boolean; source?: string }
  ): void {
    const { relative = false, source = 'internal' } = options;

    this.showControllerForMedia(video);

    let targetSpeed = this.calculateTargetSpeed(video, value, relative);
    targetSpeed = this.clampSpeed(targetSpeed);
    targetSpeed = this.resolveForcedSpeed(targetSpeed, source);

    this.setSpeed(video, targetSpeed, source);
  }

  getPreferredSpeed(_video: HTMLMediaElement): number {
    return this.config.getEffectiveSetting('speed', location.hostname) || 1.0;
  }

  setSpeed(video: VscMedia, speed: number, source = 'internal'): void {
    const speedValue = speed.toFixed(2);
    const numericSpeed = Number(speedValue);

    video.playbackRate = numericSpeed;

    video.dispatchEvent(
      new CustomEvent('ratechange', {
        bubbles: true,
        composed: true,
        detail: {
          origin: 'videoSpeed',
          speed: speedValue,
          source,
        },
      })
    );

    const speedIndicator = video.vsc?.speedIndicator;
    if (!speedIndicator) {
      logger.warn(
        'Cannot update speed indicator: video controller UI not fully initialized'
      );
      return;
    }
    speedIndicator.textContent = numericSpeed.toFixed(2);

    logger.debug(
      `Updating config.settings.lastSpeed from ${this.config.settings.lastSpeed} to ${numericSpeed}`
    );
    this.config.settings.lastSpeed = numericSpeed;

    if (this.config.settings.rememberSpeed) {
      logger.debug(`Saving lastSpeed ${numericSpeed} to Chrome storage`);
      this.config.save({
        lastSpeed: this.config.settings.lastSpeed,
      });
    } else {
      logger.debug('NOT saving to storage - rememberSpeed is false');
    }

    if (video.vsc?.div) {
      this.blinkController(video.vsc.div);
    }

    if (this.eventManager) {
      this.eventManager.refreshCoolDown();
    }
  }
}
