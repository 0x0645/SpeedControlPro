import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMinimalModules } from '../../helpers/module-loader';

await loadMinimalModules();

const { BRIDGE_ACTIONS, BRIDGE_SOURCES } = await import('../../../src/utils/message-types');
const { StorageManager } = await import('../../../src/core/storage-manager');

let originalChrome: typeof globalThis.chrome | undefined;

describe('StorageManager', () => {
  beforeEach(() => {
    originalChrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'chrome');
    StorageManager.__resetForTests();
    window.VSC = window.VSC || {};
    window.VSC.StorageManager = StorageManager;
    window.VSC.logger = window.VSC.logger || { debug() {}, error() {} };
  });

  afterEach(() => {
    if (typeof originalChrome !== 'undefined') {
      (globalThis as typeof globalThis & { chrome?: unknown }).chrome = originalChrome;
    }
    StorageManager.__resetForTests();
  });

  it('StorageManager.get loads injected page settings from DOM once', async () => {
    const el = document.createElement('script');
    el.id = 'vsc-settings-data';
    el.type = 'application/json';
    el.textContent = JSON.stringify({ lastSpeed: 1.5, rememberSpeed: true });
    document.body.appendChild(el);

    const result = await StorageManager.get({ lastSpeed: 1.0, enabled: true });

    expect(result).toEqual({ lastSpeed: 1.5, enabled: true, rememberSpeed: true });
    expect(document.getElementById('vsc-settings-data')).toBe(null);
    expect(window.VSC_settings?.lastSpeed).toBe(1.5);
  });

  it('StorageManager.set posts storage updates and merges page cache', async () => {
    const posted: unknown[] = [];
    const originalPostMessage = window.postMessage;
    window.VSC_settings = { lastSpeed: 1.25, rememberSpeed: false };
    window.postMessage = (payload: unknown) => {
      posted.push(payload);
    };

    try {
      await StorageManager.set({ rememberSpeed: true, audioBoolean: true });

      expect(posted[0]).toEqual({
        source: BRIDGE_SOURCES.PAGE,
        action: BRIDGE_ACTIONS.STORAGE_UPDATE,
        data: { rememberSpeed: true, audioBoolean: true },
      });
      expect(window.VSC_settings).toEqual({
        lastSpeed: 1.25,
        rememberSpeed: true,
        audioBoolean: true,
      });
    } finally {
      window.postMessage = originalPostMessage;
    }
  });

  it('StorageManager.remove and clear update page cache', async () => {
    window.VSC_settings = { lastSpeed: 1.25, rememberSpeed: true, audioBoolean: true };

    await StorageManager.remove(['rememberSpeed']);
    expect(window.VSC_settings).toEqual({ lastSpeed: 1.25, audioBoolean: true });

    await StorageManager.clear();
    expect(window.VSC_settings).toEqual({});
  });

  it('StorageManager.onChanged updates cache and notifies all page listeners', async () => {
    window.VSC_settings = { lastSpeed: 1.0, rememberSpeed: false };

    const calls: Array<{ listener: string; changes: Record<string, { newValue?: unknown; oldValue?: unknown }> }> = [];
    StorageManager.onChanged((changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => {
      calls.push({ listener: 'first', changes });
    });
    StorageManager.onChanged((changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => {
      calls.push({ listener: 'second', changes });
    });

    const event = new Event('message');
    Object.defineProperty(event, 'data', {
      value: {
        source: BRIDGE_SOURCES.CONTENT,
        action: BRIDGE_ACTIONS.STORAGE_CHANGED,
        data: { lastSpeed: 1.75, rememberSpeed: true },
      },
    });

    window.dispatchEvent(event);

    expect(calls.length).toBe(2);
    expect(calls[0].changes).toEqual({
      lastSpeed: { newValue: 1.75, oldValue: 1.0 },
      rememberSpeed: { newValue: true, oldValue: false },
    });
    expect(window.VSC_settings).toEqual({ lastSpeed: 1.75, rememberSpeed: true });
  });
});
