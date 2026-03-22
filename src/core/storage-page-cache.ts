import { BRIDGE_ACTIONS, BRIDGE_SOURCES } from '../utils/message-types';
import { buildStorageChanges, notifyCallbacks } from './storage-helpers';
import { logger } from '../utils/logger';
import type { StorageChangeMap, StorageSnapshot } from '../types/contracts';

let pageStorageListenerAttached = false;
let pageStorageCallbacks: Array<(changes: StorageChangeMap) => void> = [];

export function resetPageStorageCache(): void {
  pageStorageListenerAttached = false;
  pageStorageCallbacks = [];
  window.VSC_settings = null;
}

export function getCachedSettings(): StorageSnapshot | null {
  return window.VSC_settings || null;
}

export function setCachedSettings(settings: StorageSnapshot): StorageSnapshot {
  window.VSC_settings = settings;
  return window.VSC_settings;
}

export function mergeCachedSettings(data: StorageSnapshot = {}): StorageSnapshot | null {
  setCachedSettings({ ...(getCachedSettings() || {}), ...data });
  return getCachedSettings();
}

export function removeCachedKeys(keys: string[]): void {
  const cache = getCachedSettings();
  if (!cache) {
    return;
  }

  keys.forEach((key) => delete cache[key]);
}

export function postToContent(action: string, data: unknown): void {
  window.postMessage(
    {
      source: BRIDGE_SOURCES.PAGE,
      action,
      data,
    },
    '*'
  );
}

export function loadSettingsFromDom(): StorageSnapshot | null {
  const settingsElement = document.getElementById('vsc-settings-data');

  if (!settingsElement || !settingsElement.textContent) {
    return null;
  }

  try {
    const parsedSettings = JSON.parse(settingsElement.textContent) as StorageSnapshot;
    setCachedSettings(parsedSettings);
    logger.debug('Loaded settings from script element');
    settingsElement.remove();
    return parsedSettings;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to parse settings from script element: ${message}`);
    return null;
  }
}

export function subscribeToPageStorage(callback: (changes: StorageChangeMap) => void): void {
  pageStorageCallbacks.push(callback);

  if (pageStorageListenerAttached) {
    return;
  }

  pageStorageListenerAttached = true;

  window.addEventListener('message', (event) => {
    if (
      event.data?.source === BRIDGE_SOURCES.CONTENT &&
      event.data?.action === BRIDGE_ACTIONS.STORAGE_CHANGED
    ) {
      const previousSettings = getCachedSettings() || {};
      const changes = buildStorageChanges(event.data.data as StorageSnapshot, previousSettings);
      mergeCachedSettings(event.data.data as StorageSnapshot);
      notifyCallbacks(pageStorageCallbacks, changes);
    }
  });
}
