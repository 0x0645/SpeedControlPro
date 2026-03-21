import { MESSAGE_TYPES } from './message-types';

const regStrip = /^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;
const regEndsWithFlags = /\/(?!.*(.).*\1)[gimsuy]*$/;

export const DEFAULT_SETTINGS = {
  lastSpeed: 1.0,
  enabled: true,
  rememberSpeed: false,
  forceLastSavedSpeed: false,
  audioBoolean: true,
  startHidden: false,
  controllerOpacity: 0.3,
  controllerButtonSize: 14,
  keyBindings: [
    { action: 'slower', key: 83, value: 0.1, force: false, predefined: true },
    { action: 'faster', key: 68, value: 0.1, force: false, predefined: true },
    { action: 'rewind', key: 90, value: 10, force: false, predefined: true },
    { action: 'advance', key: 88, value: 10, force: false, predefined: true },
    { action: 'reset', key: 82, value: 1.0, force: false, predefined: true },
    { action: 'fast', key: 71, value: 1.8, force: false, predefined: true },
    { action: 'display', key: 86, value: 0, force: false, predefined: true },
    { action: 'mark', key: 77, value: 0, force: false, predefined: true },
    { action: 'jump', key: 74, value: 0, force: false, predefined: true },
  ],
  blacklist: `www.instagram.com
x.com
imgur.com
teams.microsoft.com
meet.google.com`.replace(regStrip, ''),
  defaultLogLevel: 4,
  logLevel: 3,
  siteProfiles: {},
};

export const formatSpeed = (speed: number): string => speed.toFixed(2);

export const LOG_LEVELS = {
  NONE: 1,
  ERROR: 2,
  WARNING: 3,
  INFO: 4,
  DEBUG: 5,
  VERBOSE: 6,
} as const;

export const SPEED_LIMITS = {
  MIN: 0.07,
  MAX: 16,
} as const;

export const CONTROLLER_SIZE_LIMITS = {
  VIDEO_MIN_WIDTH: 40,
  VIDEO_MIN_HEIGHT: 40,
  AUDIO_MIN_WIDTH: 20,
  AUDIO_MIN_HEIGHT: 20,
} as const;

export const CUSTOM_ACTIONS_NO_VALUES = ['pause', 'muted', 'mark', 'jump', 'display'];

export { regStrip, regEndsWithFlags, MESSAGE_TYPES };
