import type { ExtensionSettings, SiteProfile } from './settings';

export interface SetSpeedMessage {
  type: 'VSC_SET_SPEED';
  payload: {
    speed: number;
  };
}

export interface AdjustSpeedMessage {
  type: 'VSC_ADJUST_SPEED';
  payload: {
    delta: number;
  };
}

export interface ResetSpeedMessage {
  type: 'VSC_RESET_SPEED';
}

export interface ToggleDisplayMessage {
  type: 'VSC_TOGGLE_DISPLAY';
}

export interface GetSiteInfoMessage {
  type: 'VSC_GET_SITE_INFO';
}

export interface StateUpdateMessage {
  type: 'VSC_STATE_UPDATE';
  hasActiveControllers: boolean;
  controllerCount: number;
}

export type RuntimeMessage =
  | SetSpeedMessage
  | AdjustSpeedMessage
  | ResetSpeedMessage
  | ToggleDisplayMessage
  | GetSiteInfoMessage
  | StateUpdateMessage;

export interface SiteInfoResponse {
  speed: number;
  hostname: string;
  hasProfile: boolean;
  profile: SiteProfile | null;
}

export interface StorageChangeMap {
  [key: string]: {
    oldValue?: unknown;
    newValue?: unknown;
  };
}

export interface ExtensionToggleMessage {
  type: 'EXTENSION_TOGGLE';
  enabled: boolean;
}

export type StorageSnapshot = Partial<ExtensionSettings> & Record<string, unknown>;
