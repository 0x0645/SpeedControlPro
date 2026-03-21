import { logger } from '../../utils/logger';
import { SPEED_LIMITS } from '../../utils/constants';

function isValidSpeedChange(video: HTMLMediaElement & { vsc?: unknown }, value: unknown): boolean {
  if (!video || !video.vsc) {
    logger.warn('adjustSpeed called on video without controller');
    return false;
  }

  if (typeof value !== 'number' || isNaN(value)) {
    logger.warn('adjustSpeed called with invalid value:', value);
    return false;
  }

  return true;
}

function calculateTargetSpeed(video: HTMLMediaElement, value: number, relative?: boolean): number {
  let targetSpeed = value;

  if (relative) {
    const currentSpeed = video.playbackRate < 0.1 ? 0.0 : video.playbackRate;
    targetSpeed = currentSpeed + value;
    logger.debug(
      `Relative speed calculation: currentSpeed=${currentSpeed} + ${value} = ${targetSpeed}`
    );
  } else {
    logger.debug(`Absolute speed set: ${targetSpeed}`);
  }

  return targetSpeed;
}

function clampSpeed(targetSpeed: number): number {
  return Number(
    Math.min(
      Math.max(targetSpeed, SPEED_LIMITS.MIN),
      SPEED_LIMITS.MAX
    ).toFixed(2)
  );
}

function resolveForcedSpeed(
  targetSpeed: number,
  source: string,
  config: { settings: { forceLastSavedSpeed?: boolean; lastSpeed?: number } }
): number {
  if (source === 'external' && config.settings.forceLastSavedSpeed) {
    const forcedSpeed = config.settings.lastSpeed || 1.0;
    logger.debug(`Force mode: blocking external change, restoring to ${forcedSpeed}`);
    return forcedSpeed;
  }

  return targetSpeed;
}

export { calculateTargetSpeed, clampSpeed, isValidSpeedChange, resolveForcedSpeed };
