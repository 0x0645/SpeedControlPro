import { logger } from '../utils/logger';
import { MESSAGE_TYPES } from '../utils/message-types';
import { videoSpeedConfig } from '../core/settings';
import type {
  AdjustSpeedMessage,
  GetSiteInfoMessage,
  ResetSpeedMessage,
  RuntimeMessage,
  SetSpeedMessage,
  ToggleDisplayMessage,
} from '../types/contracts';
import type { ExtensionSettings, SiteProfile, VscMedia } from '../types/settings';

type RuntimeControllerActions = {
  adjustSpeed: (video: HTMLMediaElement, value: number, options?: { relative?: boolean }) => void;
  resetSpeed: (video: HTMLMediaElement, value: number) => void;
  runAction: (action: string, value: number, event: Event | null) => void;
};

type RuntimeHandlers = {
  getAllMediaElements: () => HTMLMediaElement[];
  actionHandler: RuntimeControllerActions | null;
  config?: {
    settings?: Partial<ExtensionSettings>;
    getSiteProfile: (hostname: string) => SiteProfile | null;
  };
};

function isSetSpeedMessage(message: RuntimeMessage): message is SetSpeedMessage {
  return message.type === MESSAGE_TYPES.SET_SPEED;
}

function isAdjustSpeedMessage(message: RuntimeMessage): message is AdjustSpeedMessage {
  return message.type === MESSAGE_TYPES.ADJUST_SPEED;
}

function isResetSpeedMessage(message: RuntimeMessage): message is ResetSpeedMessage {
  return message.type === MESSAGE_TYPES.RESET_SPEED;
}

function isToggleDisplayMessage(message: RuntimeMessage): message is ToggleDisplayMessage {
  return message.type === MESSAGE_TYPES.TOGGLE_DISPLAY;
}

function isGetSiteInfoMessage(message: RuntimeMessage): message is GetSiteInfoMessage {
  return message.type === MESSAGE_TYPES.GET_SITE_INFO;
}

export function getMediaForSpeedRead(
  getAllMediaElements: () => HTMLMediaElement[]
): HTMLMediaElement[] {
  const controlled = getAllMediaElements();
  if (controlled.length > 0) {
    return controlled;
  }

  const fallback: HTMLMediaElement[] = [];
  const media = document.querySelectorAll('video, audio');
  media.forEach((element) => {
    if (element instanceof HTMLMediaElement && element.isConnected) {
      fallback.push(element);
    }
  });
  return fallback;
}

export function getRepresentativePlaybackRate(videos: HTMLMediaElement[]): number {
  if (videos.length === 0) {
    return videoSpeedConfig.settings?.lastSpeed || 1.0;
  }

  const playing = videos.filter((video) => !video.paused);
  const candidates = playing.length > 0 ? playing : videos;
  const rates = candidates.map((video) => video.playbackRate).filter((rate) => rate >= 0.07);

  if (rates.length === 0) {
    return videoSpeedConfig.settings?.lastSpeed || 1.0;
  }

  return Math.max(...rates);
}

export function postSiteInfo(
  videos: HTMLMediaElement[],
  config: {
    settings?: Partial<ExtensionSettings>;
    getSiteProfile: (hostname: string) => SiteProfile | null;
  } = videoSpeedConfig
): void {
  const hostname = location.hostname;
  const profile = config.getSiteProfile(hostname);

  window.postMessage(
    {
      source: 'vsc-page',
      action: 'current-speed-response',
      data: {
        speed: getRepresentativePlaybackRate(videos),
        hostname,
        hasProfile: profile !== null,
        profile,
      },
    },
    '*'
  );
}

function forEachMedia(
  videos: HTMLMediaElement[],
  callback: (video: HTMLMediaElement) => void
): void {
  videos.forEach((video) => {
    callback(video);
  });
}

export function setAbsoluteSpeed(
  videos: HTMLMediaElement[],
  targetSpeed: number,
  actionHandler: RuntimeControllerActions | null
): void {
  forEachMedia(videos, (video) => {
    if ((video as VscMedia).vsc && actionHandler) {
      actionHandler.adjustSpeed(video, targetSpeed);
    } else {
      video.playbackRate = targetSpeed;
    }
  });

  logger.debug(`Set speed to ${targetSpeed} on ${videos.length} media elements`);
}

export function adjustRelativeSpeed(
  videos: HTMLMediaElement[],
  delta: number,
  actionHandler: RuntimeControllerActions | null
): void {
  forEachMedia(videos, (video) => {
    if ((video as VscMedia).vsc && actionHandler) {
      actionHandler.adjustSpeed(video, delta, { relative: true });
    } else {
      video.playbackRate = Math.min(Math.max(video.playbackRate + delta, 0.07), 16);
    }
  });

  logger.debug(`Adjusted speed by ${delta} on ${videos.length} media elements`);
}

export function resetMediaSpeed(
  videos: HTMLMediaElement[],
  actionHandler: RuntimeControllerActions | null
): void {
  forEachMedia(videos, (video) => {
    if ((video as VscMedia).vsc && actionHandler) {
      actionHandler.resetSpeed(video, 1.0);
    } else {
      video.playbackRate = 1.0;
    }
  });

  logger.debug(`Reset speed on ${videos.length} media elements`);
}

export function handleRuntimeMessage(message: RuntimeMessage, handlers: RuntimeHandlers): void {
  const videos = handlers.getAllMediaElements();

  if (isSetSpeedMessage(message)) {
    setAbsoluteSpeed(videos, message.payload.speed, handlers.actionHandler);
    return;
  }

  if (isAdjustSpeedMessage(message)) {
    adjustRelativeSpeed(videos, message.payload.delta, handlers.actionHandler);
    return;
  }

  if (isResetSpeedMessage(message)) {
    resetMediaSpeed(videos, handlers.actionHandler);
    return;
  }

  if (isToggleDisplayMessage(message)) {
    handlers.actionHandler?.runAction('display', 0, null);
    return;
  }

  if (isGetSiteInfoMessage(message)) {
    postSiteInfo(
      getMediaForSpeedRead(handlers.getAllMediaElements),
      handlers.config || videoSpeedConfig
    );
  }
}
