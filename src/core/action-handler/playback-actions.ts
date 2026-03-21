import {
  clearControllerBlinkTimeout,
  isAudioController,
  showControllerForMedia,
} from './controller-actions';
import { siteHandlerManager } from '../../site-handlers/index';
import { logger } from '../../utils/logger';
import type { VscMedia, IActionHandler, IEventManager } from '../../types/settings';

function seek(video: HTMLMediaElement, seekSeconds: number): void {
  siteHandlerManager.handleSeek(video, seekSeconds);
}

function pause(video: HTMLMediaElement): void {
  if (video.paused) {
    logger.debug('Resuming video');
    void video.play();
  } else {
    logger.debug('Pausing video');
    video.pause();
  }
}

function resetSpeed(
  video: VscMedia,
  target: number,
  actionHandler: IActionHandler,
  eventManager?: IEventManager | null
): void {
  showControllerForMedia(video, eventManager);

  if (!video.vsc) {
    logger.warn('resetSpeed called on video without controller');
    return;
  }

  const currentSpeed = video.playbackRate;

  if (currentSpeed === target) {
    if (video.vsc.speedBeforeReset !== null) {
      logger.info(`Restoring remembered speed: ${video.vsc.speedBeforeReset}`);
      const rememberedSpeed = video.vsc.speedBeforeReset!;
      video.vsc.speedBeforeReset = null;
      actionHandler.adjustSpeed(video, rememberedSpeed);
    } else {
      logger.info(`Already at reset speed ${target}, no change`);
    }

    return;
  }

  logger.info(`Remembering speed ${currentSpeed} and resetting to ${target}`);
  video.vsc.speedBeforeReset = currentSpeed;
  actionHandler.adjustSpeed(video, target);
}

function muted(video: HTMLMediaElement): void {
  video.muted = video.muted !== true;
}

function volumeUp(video: HTMLMediaElement, value: number): void {
  video.volume = Math.min(1, Number((video.volume + value).toFixed(2)));
}

function volumeDown(video: HTMLMediaElement, value: number): void {
  video.volume = Math.max(0, Number((video.volume - value).toFixed(2)));
}

function setMark(video: VscMedia): void {
  logger.debug('Adding marker');
  if (video.vsc) video.vsc.mark = video.currentTime;
}

function jumpToMark(video: VscMedia): void {
  logger.debug('Recalling marker');
  if (video.vsc?.mark && typeof video.vsc.mark === 'number') {
    video.currentTime = video.vsc.mark;
  }
}

function blinkController(
  controller: HTMLElement & { blinkTimeOut?: number },
  duration?: number
): void {
  const audioController = isAudioController(controller);

  clearControllerBlinkTimeout(controller);
  controller.classList.add('vsc-show');
  logger.debug('Showing controller temporarily with vsc-show class');

  if (!audioController) {
    controller.blinkTimeOut = window.setTimeout(() => {
      controller.classList.remove('vsc-show');
      controller.blinkTimeOut = undefined;
      logger.debug('Removing vsc-show class after timeout');
    }, duration || 2500);
  } else {
    logger.debug('Audio controller blink - keeping vsc-show class');
  }
}

export {
  blinkController,
  jumpToMark,
  muted,
  pause,
  resetSpeed,
  seek,
  setMark,
  volumeDown,
  volumeUp,
};
