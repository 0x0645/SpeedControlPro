import {
  clearControllerBlinkTimeout,
  isAudioController,
  showControllerForMedia,
} from './controller-actions.ts';

function seek(video: HTMLMediaElement, seekSeconds: number): void {
  window.VSC.siteHandlerManager.handleSeek(video, seekSeconds);
}

function pause(video: HTMLMediaElement): void {
  if (video.paused) {
    window.VSC.logger.debug('Resuming video');
    void video.play();
  } else {
    window.VSC.logger.debug('Pausing video');
    video.pause();
  }
}

function resetSpeed(
  video: HTMLMediaElement & { vsc?: any },
  target: number,
  actionHandler: { adjustSpeed: (video: HTMLMediaElement, speed: number) => void },
  eventManager?: { showController: (controller: HTMLElement) => void } | null
): void {
  showControllerForMedia(video, eventManager);

  if (!video.vsc) {
    window.VSC.logger.warn('resetSpeed called on video without controller');
    return;
  }

  const currentSpeed = video.playbackRate;

  if (currentSpeed === target) {
    if (video.vsc.speedBeforeReset !== null) {
      window.VSC.logger.info(`Restoring remembered speed: ${video.vsc.speedBeforeReset}`);
      const rememberedSpeed = video.vsc.speedBeforeReset;
      video.vsc.speedBeforeReset = null;
      actionHandler.adjustSpeed(video, rememberedSpeed);
    } else {
      window.VSC.logger.info(`Already at reset speed ${target}, no change`);
    }

    return;
  }

  window.VSC.logger.info(`Remembering speed ${currentSpeed} and resetting to ${target}`);
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

function setMark(video: HTMLMediaElement & { vsc?: any }): void {
  window.VSC.logger.debug('Adding marker');
  video.vsc.mark = video.currentTime;
}

function jumpToMark(video: HTMLMediaElement & { vsc?: any }): void {
  window.VSC.logger.debug('Recalling marker');
  if (video.vsc.mark && typeof video.vsc.mark === 'number') {
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
  window.VSC.logger.debug('Showing controller temporarily with vsc-show class');

  if (!audioController) {
    controller.blinkTimeOut = window.setTimeout(() => {
      controller.classList.remove('vsc-show');
      controller.blinkTimeOut = undefined;
      window.VSC.logger.debug('Removing vsc-show class after timeout');
    }, duration || 2500);
  } else {
    window.VSC.logger.debug('Audio controller blink - keeping vsc-show class');
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
