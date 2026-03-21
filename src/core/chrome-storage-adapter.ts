import { logger } from '../utils/logger';
import type { ExtensionSettings } from '../types/settings';
import type { StorageChangeMap, StorageSnapshot } from '../types/contracts';

function getChromeStorage() {
  return globalThis.chrome.storage.sync;
}

function reportStorageError(operation: string, runtimeError: Error, context: unknown = {}): Error {
  const error = new Error(`Storage ${operation} failed: ${runtimeError.message}`);
  console.error(`Chrome storage ${operation} failed:`, runtimeError);
  return Object.assign(error, { context });
}

export function hasChromeStorage(): boolean {
  const runtimeChrome = globalThis.chrome;
  return typeof runtimeChrome !== 'undefined' && !!runtimeChrome.storage?.sync;
}

export async function getFromChromeStorage(
  defaults: Partial<ExtensionSettings> = {}
): Promise<StorageSnapshot> {
  return new Promise((resolve) => {
    getChromeStorage().get(defaults, (storage: StorageSnapshot) => {
      logger.debug('Retrieved settings from chrome.storage');
      resolve(storage);
    });
  });
}

export async function setInChromeStorage(data: StorageSnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    getChromeStorage().set(data, () => {
      if (globalThis.chrome.runtime.lastError) {
        reject(reportStorageError('save', globalThis.chrome.runtime.lastError, data));
        return;
      }

      logger.debug('Settings saved to chrome.storage');
      resolve();
    });
  });
}

export async function removeFromChromeStorage(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    getChromeStorage().remove(keys, () => {
      if (globalThis.chrome.runtime.lastError) {
        reject(
          reportStorageError('remove', globalThis.chrome.runtime.lastError, {
            removedKeys: keys,
          })
        );
        return;
      }

      logger.debug('Keys removed from storage');
      resolve();
    });
  });
}

export async function clearChromeStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    getChromeStorage().clear(() => {
      if (globalThis.chrome.runtime.lastError) {
        reject(
          reportStorageError('clear', globalThis.chrome.runtime.lastError, {
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

export function subscribeToChromeStorage(callback: (changes: StorageChangeMap) => void): void {
  if (!globalThis.chrome.storage.onChanged) {
    return;
  }

  globalThis.chrome.storage.onChanged.addListener((changes: StorageChangeMap, areaName: string) => {
    if (areaName === 'sync') {
      callback(changes);
    }
  });
}
