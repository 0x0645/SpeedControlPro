import type { StorageChangeMap } from '../types/contracts';

function normalizeKeys(keys: string | string[]): string[] {
  return Array.isArray(keys) ? keys : [keys];
}

function buildStorageChanges(
  data: Record<string, unknown>,
  previousData: Record<string, unknown> = {}
): StorageChangeMap {
  const changes: StorageChangeMap = {};

  Object.entries(data || {}).forEach(([key, value]) => {
    changes[key] = {
      newValue: value,
      oldValue: previousData?.[key],
    };
  });

  return changes;
}

function notifyCallbacks(
  callbacks: Array<(changes: StorageChangeMap) => void>,
  changes: StorageChangeMap
): void {
  callbacks.forEach((callback) => callback(changes));
}

export { buildStorageChanges, normalizeKeys, notifyCallbacks };
