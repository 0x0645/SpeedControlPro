import type { ExtensionSettings, KeyBinding, SiteProfile } from '../types/settings';

function cloneDefaultKeyBindings(): KeyBinding[] {
  return window.VSC.Constants.DEFAULT_SETTINGS.keyBindings.map((binding: KeyBinding) => ({
    ...binding,
  }));
}

function normalizeKeyBindings(keyBindings: unknown): KeyBinding[] {
  if (!Array.isArray(keyBindings) || keyBindings.length === 0) {
    return cloneDefaultKeyBindings();
  }

  return keyBindings.map((binding) => ({ ...(binding as KeyBinding) }));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeSiteProfiles(siteProfiles: unknown): Record<string, SiteProfile> {
  if (!siteProfiles || typeof siteProfiles !== 'object' || Array.isArray(siteProfiles)) {
    return {};
  }

  const normalizedProfiles: Record<string, SiteProfile> = {};

  Object.entries(siteProfiles as Record<string, unknown>).forEach(([hostname, profile]) => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return;
    }

    const cleanedProfile = Object.fromEntries(
      Object.entries(profile).filter(([, value]) => value !== null && value !== undefined)
    ) as SiteProfile;

    if (Object.keys(cleanedProfile).length > 0) {
      normalizedProfiles[hostname] = cleanedProfile;
    }
  });

  return normalizedProfiles;
}

function normalizeStoredSettings(storage: Partial<ExtensionSettings>) {
  const defaults = window.VSC.Constants.DEFAULT_SETTINGS as ExtensionSettings;

  return {
    keyBindings: normalizeKeyBindings(storage.keyBindings),
    lastSpeed: normalizeNumber(storage.lastSpeed, defaults.lastSpeed),
    rememberSpeed: normalizeBoolean(storage.rememberSpeed, defaults.rememberSpeed),
    forceLastSavedSpeed: normalizeBoolean(
      storage.forceLastSavedSpeed,
      defaults.forceLastSavedSpeed
    ),
    audioBoolean: normalizeBoolean(storage.audioBoolean, defaults.audioBoolean),
    startHidden: normalizeBoolean(storage.startHidden, defaults.startHidden),
    controllerOpacity: normalizeNumber(storage.controllerOpacity, defaults.controllerOpacity),
    controllerButtonSize: normalizeNumber(
      storage.controllerButtonSize,
      defaults.controllerButtonSize
    ),
    logLevel: normalizeNumber(storage.logLevel, defaults.logLevel),
    siteProfiles: normalizeSiteProfiles(storage.siteProfiles),
  };
}

export {
  cloneDefaultKeyBindings,
  normalizeBoolean,
  normalizeKeyBindings,
  normalizeNumber,
  normalizeSiteProfiles,
  normalizeStoredSettings,
};
