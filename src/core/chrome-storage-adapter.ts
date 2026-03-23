import { logger } from '../utils/logger';
import type { ExtensionSettings } from '../types/settings';
import type { StorageChangeMap, StorageSnapshot } from '../types/contracts';

function getChromeStorage() {
  return globalThis.chrome.storage.sync;
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as Promise<T>).then === 'function';
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
  defaults: Partial<ExtensionSettings> | null = null
): Promise<StorageSnapshot> {
  const storageArea = getChromeStorage();
  const getMethod = storageArea.get;

  // Pass null to chrome.storage.get when defaults is empty or null,
  // so Chrome returns ALL stored items instead of nothing.
  const keys = defaults !== null && Object.keys(defaults).length > 0 ? defaults : null;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (storage: StorageSnapshot) => {
      if (settled) {
        return;
      }
      settled = true;
      logger.debug('Retrieved settings from chrome.storage');
      resolve(storage);
    };

    const result = getMethod.call(storageArea, keys, (storage: StorageSnapshot) => {
      finish(storage);
    });

    if (isPromiseLike<StorageSnapshot>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}

export async function setInChromeStorage(data: StorageSnapshot): Promise<void> {
  const storageArea = getChromeStorage();
  const setMethod = storageArea.set;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (globalThis.chrome.runtime.lastError) {
        reject(reportStorageError('save', globalThis.chrome.runtime.lastError, data));
        return;
      }

      logger.debug('Settings saved to chrome.storage');
      resolve();
    };

    const result = setMethod.call(storageArea, data, finish);
    if (isPromiseLike<void>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}

export async function removeFromChromeStorage(keys: string[]): Promise<void> {
  const storageArea = getChromeStorage();
  const removeMethod = storageArea.remove;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
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
    };

    const result = removeMethod.call(storageArea, keys, finish);
    if (isPromiseLike<void>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}

export async function clearChromeStorage(): Promise<void> {
  const storageArea = getChromeStorage();
  const clearMethod = storageArea.clear;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
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
    };

    const result = clearMethod.call(storageArea, finish);
    if (isPromiseLike<void>(result)) {
      void result.then(finish).catch(reject);
    }
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
