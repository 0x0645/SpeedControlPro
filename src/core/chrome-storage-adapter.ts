import { logger } from '../utils/logger';
import type { ExtensionSettings } from '../types/settings';
import type { StorageChangeMap, StorageSnapshot } from '../types/contracts';

function getChromeStorage() {
  return globalThis.chrome.storage.sync;
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as Promise<T>).then === 'function';
}

function supportsPromiseApi(method: (...args: unknown[]) => unknown, argCount: number): boolean {
  return method.length <= argCount;
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
  const getMethod = getChromeStorage().get;
  if (supportsPromiseApi(getMethod, 1)) {
    const promiseResult = getMethod(defaults);
    if (isPromiseLike<StorageSnapshot>(promiseResult)) {
      const storage = await promiseResult;
      logger.debug('Retrieved settings from chrome.storage');
      return storage;
    }
  }

  return new Promise((resolve) => {
    getMethod(defaults, (storage: StorageSnapshot) => {
      logger.debug('Retrieved settings from chrome.storage');
      resolve(storage);
    });
  });
}

export async function setInChromeStorage(data: StorageSnapshot): Promise<void> {
  const setMethod = getChromeStorage().set;
  if (supportsPromiseApi(setMethod, 1)) {
    const promiseResult = setMethod(data);
    if (isPromiseLike<void>(promiseResult)) {
      await promiseResult;
      logger.debug('Settings saved to chrome.storage');
      return;
    }
  }

  return new Promise((resolve, reject) => {
    setMethod(data, () => {
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
  const removeMethod = getChromeStorage().remove;
  if (supportsPromiseApi(removeMethod, 1)) {
    const promiseResult = removeMethod(keys);
    if (isPromiseLike<void>(promiseResult)) {
      await promiseResult;
      logger.debug('Keys removed from storage');
      return;
    }
  }

  return new Promise((resolve, reject) => {
    removeMethod(keys, () => {
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
  const clearMethod = getChromeStorage().clear;
  if (supportsPromiseApi(clearMethod, 0)) {
    const promiseResult = clearMethod();
    if (isPromiseLike<void>(promiseResult)) {
      await promiseResult;
      logger.debug('Storage cleared');
      return;
    }
  }

  return new Promise((resolve, reject) => {
    clearMethod(() => {
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
