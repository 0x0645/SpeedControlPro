import { describe, it, expect } from 'vitest';

function installBackgroundChromeMock() {
  const calls = {
    setIcon: [] as unknown[],
    setStorage: [] as Record<string, unknown>[],
    setSessionStorage: [] as Record<string, unknown>[],
    removeStorage: [] as string[][],
    getStorage: [] as Record<string, unknown>[],
    getSessionStorage: [] as Record<string, unknown>[],
  };

  const listeners: {
    onChanged: ((payload: unknown) => void) | null;
    onMessage: ((payload: unknown) => void) | null;
    onInstalled: (() => void) | null;
    onStartup: (() => void) | null;
  } = {
    onChanged: null,
    onMessage: null,
    onInstalled: null,
    onStartup: null,
  };

  global.chrome = {
    action: {
      setIcon: async (payload: unknown) => {
        calls.setIcon.push(payload);
      },
    },
    storage: {
      sync: {
        get: async (defaults: Record<string, unknown>) => {
          calls.getStorage.push(defaults);
          return { enabled: true, siteSpeedMap: { 'example.com': '1.5' }, siteProfiles: null };
        },
        set: async (payload: Record<string, unknown>) => {
          calls.setStorage.push(payload);
        },
        remove: async (keys: string[]) => {
          calls.removeStorage.push(keys);
        },
      },
      session: {
        get: async (defaults: Record<string, unknown>) => {
          calls.getSessionStorage.push(defaults);
          return defaults;
        },
        set: async (payload: Record<string, unknown>) => {
          calls.setSessionStorage.push(payload);
        },
      },
      onChanged: {
        addListener: (callback: (payload: unknown) => void) => {
          listeners.onChanged = callback;
        },
      },
    },
    runtime: {
      onMessage: {
        addListener: (callback: (payload: unknown) => void) => {
          listeners.onMessage = callback;
        },
      },
      onInstalled: {
        addListener: (callback: () => void) => {
          listeners.onInstalled = callback;
        },
      },
      onStartup: {
        addListener: (callback: () => void) => {
          listeners.onStartup = callback;
        },
      },
    },
    tabs: {
      onRemoved: {
        addListener: () => {},
      },
    },
  } as typeof chrome;

  return { calls, listeners };
}

describe('Background', () => {
  it('background helpers migrate config and update icons', async () => {
    const { calls } = installBackgroundChromeMock();
    const background = await import('../../../src/background');

    await background.updateIcon(false);
    await background.initializeIcon();
    await background.migrateConfig();

    expect(calls.setIcon.length >= 2).toBe(true);
    expect(calls.setStorage[0]).toEqual({
      siteProfiles: { 'example.com': { speed: 1.5 } },
    });
    expect(calls.removeStorage.length >= 2).toBe(true);
  });
});
