import { BRIDGE_ACTIONS, BRIDGE_SOURCES } from '../utils/message-types';
import { normalizeKeys } from './storage-helpers';
import {
  clearChromeStorage,
  getFromChromeStorage,
  hasChromeStorage,
  removeFromChromeStorage,
  setInChromeStorage,
  subscribeToChromeStorage,
} from './chrome-storage-adapter';
import {
  getCachedSettings,
  loadSettingsFromDom,
  mergeCachedSettings,
  removeCachedKeys,
  resetPageStorageCache,
  setCachedSettings,
  subscribeToPageStorage,
} from './storage-page-cache';
import { logger } from '../utils/logger';
import type { ExtensionSettings } from '../types/settings';
import type { StorageChangeMap, StorageSnapshot } from '../types/contracts';

export class StorageManager {
  static errorCallback: ((error: Error, context: unknown) => void) | null = null;

  static __resetForTests() {
    this.errorCallback = null;
    resetPageStorageCache();
  }

  static hasChromeStorage() {
    return hasChromeStorage();
  }

  static getCachedSettings(): StorageSnapshot | null {
    return getCachedSettings();
  }

  static setCachedSettings(settings: StorageSnapshot) {
    return setCachedSettings(settings);
  }

  static mergeCachedSettings(data: StorageSnapshot = {}) {
    return mergeCachedSettings(data);
  }

  static removeCachedKeys(keys: string | string[]) {
    removeCachedKeys(normalizeKeys(keys));
  }

  static postToContent(action: string, data: unknown) {
    window.postMessage(
      {
        source: BRIDGE_SOURCES.PAGE,
        action,
        data,
      },
      '*'
    );
  }

  static reportStorageError(operation: string, runtimeError: Error, context: unknown = {}) {
    const error = new Error(`Storage ${operation} failed: ${runtimeError.message}`);
    console.error(`Chrome storage ${operation} failed:`, runtimeError);

    if (this.errorCallback) {
      this.errorCallback(error, context);
    }

    return error;
  }

  static loadSettingsFromDom(): StorageSnapshot | null {
    return loadSettingsFromDom();
  }

  static onError(callback: (error: Error, context: unknown) => void) {
    this.errorCallback = callback;
  }

  static async get(defaults: Partial<ExtensionSettings> = {}): Promise<StorageSnapshot> {
    if (this.hasChromeStorage()) {
      return getFromChromeStorage(defaults);
    }

    if (!this.getCachedSettings()) {
      this.loadSettingsFromDom();
    }

    if (this.getCachedSettings()) {
      logger.debug('Using VSC_settings');
      return Promise.resolve({ ...defaults, ...this.getCachedSettings() });
    }

    logger.debug('No settings available, using defaults');
    return Promise.resolve(defaults);
  }

  static async set(data: StorageSnapshot): Promise<void> {
    if (this.hasChromeStorage()) {
      return setInChromeStorage(data).catch((error: Error) => {
        throw this.reportStorageError('save', error, data);
      });
    }

    logger.debug('Sending storage update to content script');
    this.postToContent(BRIDGE_ACTIONS.STORAGE_UPDATE, data);
    this.mergeCachedSettings(data);
    return Promise.resolve();
  }

  static async remove(keys: string | string[]): Promise<void> {
    const normalizedKeys = normalizeKeys(keys);

    if (this.hasChromeStorage()) {
      return removeFromChromeStorage(normalizedKeys).catch((error: Error) => {
        throw this.reportStorageError('remove', error, {
          removedKeys: normalizedKeys,
        });
      });
    }

    this.removeCachedKeys(normalizedKeys);
    return Promise.resolve();
  }

  static async clear(): Promise<void> {
    if (this.hasChromeStorage()) {
      return clearChromeStorage().catch((error: Error) => {
        throw this.reportStorageError('clear', error, {
          operation: 'clear',
        });
      });
    }

    this.setCachedSettings({});
    return Promise.resolve();
  }

  static onChanged(callback: (changes: StorageChangeMap) => void) {
    if (this.hasChromeStorage() && globalThis.chrome.storage.onChanged) {
      subscribeToChromeStorage(callback);
      return;
    }

    subscribeToPageStorage(callback);
  }
}
