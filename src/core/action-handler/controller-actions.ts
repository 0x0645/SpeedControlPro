import { stateManager } from '../state-manager';
import { logger } from '../../utils/logger';

function getControlledMedia(): HTMLMediaElement[] {
  return stateManager ? stateManager.getControlledElements() : [];
}

function getTargetControllerFromEvent(event: Event | null | undefined): HTMLElement | null {
  const target = event?.target as HTMLElement | null;
  const root = target?.getRootNode?.() as ShadowRoot | Document | undefined;
  return root && 'host' in root ? ((root as ShadowRoot).host as HTMLElement) : null;
}

function shouldSkipMediaForEvent(
  video: HTMLMediaElement & { vsc?: { div?: HTMLElement } },
  targetController: HTMLElement | null,
  event?: Event | null
): boolean {
  const controller = video.vsc?.div;

  if (!controller) {
    return true;
  }

  if (event && targetController && targetController !== controller) {
    return true;
  }

  return video.classList.contains('vsc-cancelled');
}

function showControllerForMedia(
  video: HTMLMediaElement & { vsc?: { div?: HTMLElement } },
  eventManager?: { showController: (controller: HTMLElement) => void } | null
): void {
  const controller = video.vsc?.div;

  if (controller && eventManager) {
    eventManager.showController(controller);
  }
}

function clearControllerBlinkTimeout(controller: HTMLElement & { blinkTimeOut?: number }): void {
  if (controller.blinkTimeOut !== undefined) {
    clearTimeout(controller.blinkTimeOut);
    controller.blinkTimeOut = undefined;
  }
}

function clearEventManagerTimer(eventManager?: { timer?: number | null } | null): void {
  if (eventManager?.timer) {
    clearTimeout(eventManager.timer);
    eventManager.timer = null;
  }
}

function toggleControllerDisplay(
  video: HTMLMediaElement & { vsc?: { div?: HTMLElement } },
  eventManager?: { timer?: number | null } | null
): void {
  logger.debug('Display action triggered');

  const controller = video.vsc?.div as (HTMLElement & { blinkTimeOut?: number }) | undefined;

  if (!controller) {
    logger.error('No controller found for video');
    return;
  }

  controller.classList.add('vsc-manual');
  controller.classList.toggle('vsc-hidden');

  clearControllerBlinkTimeout(controller);
  clearEventManagerTimer(eventManager);

  if (controller.classList.contains('vsc-hidden')) {
    controller.classList.remove('vsc-show');
    logger.debug('Removed vsc-show class for immediate manual hide');
  }
}

function isAudioController(controller: HTMLElement): boolean {
  const mediaElements = getControlledMedia();

  for (const media of mediaElements) {
    if ((media as any).vsc && (media as any).vsc.div === controller) {
      return media.tagName === 'AUDIO';
    }
  }

  return false;
}

export {
  clearControllerBlinkTimeout,
  clearEventManagerTimer,
  getControlledMedia,
  getTargetControllerFromEvent,
  isAudioController,
  shouldSkipMediaForEvent,
  showControllerForMedia,
  toggleControllerDisplay,
};
