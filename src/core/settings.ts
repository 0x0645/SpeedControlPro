import {
  cloneDefaultKeyBindings,
  normalizeSiteProfiles,
  normalizeStoredSettings,
} from './settings-helpers';
import { logger } from '../utils/logger';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { StorageManager } from './storage-manager';
import type { ExtensionSettings, KeyBinding, SiteProfile } from '../types/settings';
import type { StorageSnapshot } from '../types/contracts';
import { normalizeHostname } from '../utils/hostname';

type ResolvedProfile = SiteProfile & {
  audioBoolean: boolean;
  keyBindings: KeyBinding[];
};

export class VideoSpeedConfig {
  settings: ExtensionSettings;
  pendingSave: number | null;
  saveTimer: ReturnType<typeof setTimeout> | null;
  SAVE_DELAY: number;

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS } as ExtensionSettings;
    this.pendingSave = null;
    this.saveTimer = null;
    this.SAVE_DELAY = 1000;
  }

  __resetForTests(): void {
    this.settings = { ...DEFAULT_SETTINGS } as ExtensionSettings;
    this.pendingSave = null;

    if (this.saveTimer) {
      globalThis.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async load(): Promise<ExtensionSettings> {
    try {
      const storage = await StorageManager.get(DEFAULT_SETTINGS);
      const normalizedSettings = normalizeStoredSettings(storage);

      if (!storage.keyBindings || storage.keyBindings.length === 0) {
        logger.info('First initialization - setting up default key bindings');
        normalizedSettings.keyBindings = cloneDefaultKeyBindings();
        await this.save({ keyBindings: normalizedSettings.keyBindings });
      }

      this.settings = {
        ...this.settings,
        ...normalizedSettings,
      };

      this.ensureDisplayBinding();
      logger.setVerbosity(this.settings.logLevel);

      logger.info('Settings loaded successfully');
      return this.settings;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load settings: ${message}`);
      return DEFAULT_SETTINGS as ExtensionSettings;
    }
  }

  async save(newSettings: Partial<ExtensionSettings> = {}): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };

      const keys = Object.keys(newSettings);
      if (keys.length === 1 && keys[0] === 'lastSpeed') {
        this.pendingSave = newSettings.lastSpeed ?? null;

        if (this.saveTimer) {
          globalThis.clearTimeout(this.saveTimer);
        }

        this.saveTimer = globalThis.setTimeout(async () => {
          const speedToSave = this.pendingSave;
          this.pendingSave = null;
          this.saveTimer = null;

          await StorageManager.set({ ...this.settings, lastSpeed: speedToSave ?? this.settings.lastSpeed } as StorageSnapshot);
          logger.info('Debounced speed setting saved successfully');
        }, this.SAVE_DELAY);

        return;
      }

      await StorageManager.set(this.settings as StorageSnapshot);

      if (newSettings.logLevel !== undefined) {
        logger.setVerbosity(this.settings.logLevel);
      }

      logger.info('Settings saved successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save settings: ${message}`);
    }
  }

  getKeyBinding(action: string, property: keyof KeyBinding | string = 'value'): unknown {
    try {
      const binding = this.settings.keyBindings.find((item) => item.action === action);
      return binding ? binding[property as keyof KeyBinding] : false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get key binding for ${action}: ${message}`);
      return false;
    }
  }

  setKeyBinding(action: string, value: unknown): void {
    try {
      const binding = this.settings.keyBindings.find((item) => item.action === action);
      if (!binding) {
        logger.warn(`No key binding found for action: ${action}`);
        return;
      }

      if (['reset', 'fast', 'slower', 'faster'].includes(action)) {
        if (typeof value !== 'number' || isNaN(value)) {
          logger.warn(`Invalid numeric value for ${action}: ${value}`);
          return;
        }
      }

      binding.value = value as number;
      logger.debug(`Updated key binding ${action} to ${value}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to set key binding for ${action}: ${message}`);
    }
  }

  getEffectiveSetting(key: string, hostname: string): unknown {
    const profile = this.getSiteProfile(hostname);
    const globalKey = key === 'speed' ? 'lastSpeed' : key;
    if (
      profile &&
      profile[key as keyof SiteProfile] !== undefined &&
      profile[key as keyof SiteProfile] !== null
    ) {
      return profile[key as keyof SiteProfile];
    }
    return this.settings[globalKey as keyof ExtensionSettings];
  }

  getSiteProfile(hostname: string): SiteProfile | null {
    const profiles = this.settings.siteProfiles || {};
    const normalized = normalizeHostname(hostname) || hostname;
    return profiles[normalized] || profiles[hostname] || null;
  }

  getResolvedProfile(hostname: string): ResolvedProfile {
    const profile = this.getSiteProfile(hostname) || {};
    return {
      speed: profile.speed ?? this.settings.lastSpeed,
      controllerOpacity: profile.controllerOpacity ?? this.settings.controllerOpacity,
      controllerButtonSize: profile.controllerButtonSize ?? this.settings.controllerButtonSize,
      startHidden: profile.startHidden ?? this.settings.startHidden,
      audioBoolean: profile.audioBoolean ?? this.settings.audioBoolean,
      keyBindings: profile.keyBindings ?? this.settings.keyBindings,
    };
  }

  async setSiteProfile(hostname: string, profileData: Partial<SiteProfile>): Promise<void> {
    if (!this.settings.siteProfiles) {
      this.settings.siteProfiles = {};
    }
    const key = normalizeHostname(hostname) || hostname;
    const existing = this.settings.siteProfiles[key] || {};
    this.settings.siteProfiles[key] = { ...existing, ...profileData };
    this.settings.siteProfiles = normalizeSiteProfiles(this.settings.siteProfiles);
    await this.save({ siteProfiles: this.settings.siteProfiles });
    logger.info(`Saved site profile for ${hostname}`);
  }

  async removeSiteProfile(hostname: string): Promise<void> {
    const key = normalizeHostname(hostname) || hostname;
    if (this.settings.siteProfiles?.[key]) {
      delete this.settings.siteProfiles[key];
      await this.save({ siteProfiles: this.settings.siteProfiles });
      logger.info(`Removed site profile for ${hostname}`);
    }
  }

  ensureDisplayBinding(): void {
    const hasDisplayBinding = this.settings.keyBindings.some(
      (binding) => binding.action === 'display'
    );
    const hasPredefinedBindings = this.settings.keyBindings.some((binding) => binding.predefined);

    if (!hasDisplayBinding && hasPredefinedBindings) {
      this.settings.keyBindings.push({
        action: 'display',
        key: 86,
        value: 0,
        force: false,
        predefined: true,
      });
    }
  }
}

export const videoSpeedConfig = new VideoSpeedConfig();
