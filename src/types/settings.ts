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
  audioBoolean?: boolean | null;
  controllerOpacity?: number | null;
  controllerButtonSize?: number | null;
  keyBindings?: KeyBinding[] | null;
}

export interface ExtensionSettings {
  lastSpeed: number;
  enabled: boolean;
  speeds?: Record<string, number>;
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

/** The `vsc` property attached to media elements by VideoController */
export interface VscAttachment {
  div?: HTMLElement;
  speedIndicator?: { textContent: string };
  controllerId?: string;
  speedBeforeReset?: number | null;
  mark?: number;
  remove?: () => void;
  updateVisibility?: () => void;
}

/** A media element that may have a VSC controller attached */
export type VscMedia = HTMLMediaElement & {
  vsc?: VscAttachment;
};

/** Minimal interface for the config object used across the codebase */
export interface IVideoSpeedConfig {
  settings: ExtensionSettings;
  load(): Promise<ExtensionSettings>;
  save(newSettings?: Partial<ExtensionSettings>): Promise<void>;
  getKeyBinding(action: string, property?: keyof KeyBinding | string): unknown;
  setKeyBinding(action: string, value: unknown): void;
  getEffectiveSetting(key: string, hostname: string): unknown;
  getSiteProfile(hostname: string): SiteProfile | null;
  getResolvedProfile(hostname: string): SiteProfile & { audioBoolean: boolean; keyBindings: KeyBinding[] };
  setSiteProfile(hostname: string, profileData: Partial<SiteProfile>): Promise<void>;
  removeSiteProfile(hostname: string): Promise<void>;
}

/** Minimal interface for the action handler */
export interface IActionHandler {
  config: IVideoSpeedConfig;
  eventManager: IEventManager | null;
  runAction(action: string, value: unknown, e?: Event | null): void;
  executeAction(action: string, value: unknown, video: VscMedia, e?: Event | null): void;
  adjustSpeed(video: VscMedia, value: number, options?: { relative?: boolean; source?: string }): void;
  resetSpeed(video: VscMedia, target: number): void;
  showControllerForMedia(video: VscMedia): void;
}

/** Minimal interface for the event manager */
export interface IEventManager {
  actionHandler: IActionHandler | null;
  timer?: number | null;
  setupEventListeners(document: Document): void;
  showController(controller: HTMLElement): void;
  refreshCoolDown(): void;
}
