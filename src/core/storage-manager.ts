import { BRIDGE_ACTIONS, BRIDGE_SOURCES } from '../utils/message-types';
import { buildStorageChanges, normalizeKeys, notifyCallbacks } from './storage-helpers';
import { logger } from '../utils/logger';
import type { ExtensionSettings } from '../types/settings';
import type { StorageChangeMap, StorageSnapshot } from '../types/contracts';

export class StorageManager {
  static errorCallback: ((error: Error, context: unknown) => void) | null = null;
  static _pageStorageListenerAttached = false;
  static _pageStorageCallbacks: Array<(changes: StorageChangeMap) => void> = [];

  static __resetForTests() {
    this.errorCallback = null;
    this._pageStorageListenerAttached = false;
    this._pageStorageCallbacks = [];
    window.VSC_settings = null;
  }

  static hasChromeStorage() {
    const runtimeChrome = globalThis.chrome;
    return (
      typeof runtimeChrome !== 'undefined' && runtimeChrome.storage && runtimeChrome.storage.sync
    );
  }

  static getCachedSettings(): StorageSnapshot | null {
    return window.VSC_settings || null;
  }

  static setCachedSettings(settings: StorageSnapshot) {
    window.VSC_settings = settings;
    return window.VSC_settings;
  }

  static mergeCachedSettings(data: StorageSnapshot = {}) {
    this.setCachedSettings({ ...(this.getCachedSettings() || {}), ...data });
    return this.getCachedSettings();
  }

  static removeCachedKeys(keys: string | string[]) {
    const cache = this.getCachedSettings();
    if (!cache) {
      return;
    }

    normalizeKeys(keys).forEach((key) => delete cache[key]);
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
    const settingsElement = document.getElementById('vsc-settings-data');

    if (!settingsElement || !settingsElement.textContent) {
      return null;
    }

    try {
      const parsedSettings = JSON.parse(settingsElement.textContent) as StorageSnapshot;
      this.setCachedSettings(parsedSettings);
      logger.debug('Loaded settings from script element');
      settingsElement.remove();
      return parsedSettings;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to parse settings from script element: ${message}`);
      return null;
    }
  }

  static onError(callback: (error: Error, context: unknown) => void) {
    this.errorCallback = callback;
  }

  static async get(defaults: Partial<ExtensionSettings> = {}): Promise<StorageSnapshot> {
    if (this.hasChromeStorage()) {
      return new Promise((resolve) => {
        globalThis.chrome.storage.sync.get(defaults, (storage: StorageSnapshot) => {
          logger.debug('Retrieved settings from chrome.storage');
          resolve(storage);
        });
      });
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
      return new Promise((resolve, reject) => {
        globalThis.chrome.storage.sync.set(data, () => {
          if (globalThis.chrome.runtime.lastError) {
            reject(this.reportStorageError('save', globalThis.chrome.runtime.lastError, data));
            return;
          }
          logger.debug('Settings saved to chrome.storage');
          resolve();
        });
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
      return new Promise((resolve, reject) => {
        globalThis.chrome.storage.sync.remove(normalizedKeys, () => {
          if (globalThis.chrome.runtime.lastError) {
            reject(
              this.reportStorageError('remove', globalThis.chrome.runtime.lastError, {
                removedKeys: normalizedKeys,
              })
            );
            return;
          }
          logger.debug('Keys removed from storage');
          resolve();
        });
      });
    }

    this.removeCachedKeys(normalizedKeys);
    return Promise.resolve();
  }

  static async clear(): Promise<void> {
    if (this.hasChromeStorage()) {
      return new Promise((resolve, reject) => {
        globalThis.chrome.storage.sync.clear(() => {
          if (globalThis.chrome.runtime.lastError) {
            reject(
              this.reportStorageError('clear', globalThis.chrome.runtime.lastError, {
                operation: 'clear',
              })
            );
            return;
          }
          logger.debug('Storage cleared');
          resolve();
        });
      });
    }

    this.setCachedSettings({});
    return Promise.resolve();
  }

  static onChanged(callback: (changes: StorageChangeMap) => void) {
    if (this.hasChromeStorage() && globalThis.chrome.storage.onChanged) {
      globalThis.chrome.storage.onChanged.addListener(
        (changes: StorageChangeMap, areaName: string) => {
          if (areaName === 'sync') {
            callback(changes);
          }
        }
      );
      return;
    }

    this._pageStorageCallbacks.push(callback);

    if (this._pageStorageListenerAttached) {
      return;
    }

    this._pageStorageListenerAttached = true;

    window.addEventListener('message', (event) => {
      if (
        event.data?.source === BRIDGE_SOURCES.CONTENT &&
        event.data?.action === BRIDGE_ACTIONS.STORAGE_CHANGED
      ) {
        const previousSettings = this.getCachedSettings() || {};
        const changes = buildStorageChanges(
          event.data.data,
          previousSettings as Record<string, unknown>
        );
        this.mergeCachedSettings(event.data.data as StorageSnapshot);
        notifyCallbacks(this._pageStorageCallbacks, changes);
      }
    });
  }
}
