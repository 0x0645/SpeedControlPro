export interface KeyBinding {
  action: string;
  key: number;
  value: number;
  force?: boolean | string;
  predefined?: boolean;
}

export interface SiteProfile {
  speed?: number | null;
  startHidden?: boolean | null;
  controllerOpacity?: number | null;
  controllerButtonSize?: number | null;
}

export interface ExtensionSettings {
  lastSpeed: number;
  enabled: boolean;
  speeds: Record<string, number>;
  keyBindings: KeyBinding[];
  blacklist: string;
  forceLastSavedSpeed: boolean;
  audioBoolean: boolean;
  startHidden: boolean;
  controllerOpacity: number;
  controllerButtonSize: number;
  rememberSpeed: boolean;
  logLevel: number;
  siteProfiles: Record<string, SiteProfile>;
}
