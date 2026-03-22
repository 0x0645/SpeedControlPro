import { assert, SimpleTestRunner } from '../../helpers/test-utils.js';

const runner = new SimpleTestRunner();

function installBackgroundChromeMock() {
  const calls = {
    setIcon: [],
    setStorage: [],
    setSessionStorage: [],
    removeStorage: [],
    getStorage: [],
    getSessionStorage: [],
  };

  const listeners = {
    onChanged: null,
    onMessage: null,
    onInstalled: null,
    onStartup: null,
  };

  global.chrome = {
    action: {
      setIcon: async (payload) => {
        calls.setIcon.push(payload);
      },
    },
    storage: {
      sync: {
        get: async (defaults) => {
          calls.getStorage.push(defaults);
          return { enabled: true, siteSpeedMap: { 'example.com': '1.5' }, siteProfiles: null };
        },
        set: async (payload) => {
          calls.setStorage.push(payload);
        },
        remove: async (keys) => {
          calls.removeStorage.push(keys);
        },
      },
      session: {
        get: async (defaults) => {
          calls.getSessionStorage.push(defaults);
          return defaults;
        },
        set: async (payload) => {
          calls.setSessionStorage.push(payload);
        },
      },
      onChanged: {
        addListener: (callback) => {
          listeners.onChanged = callback;
        },
      },
    },
    runtime: {
      onMessage: {
        addListener: (callback) => {
          listeners.onMessage = callback;
        },
      },
      onInstalled: {
        addListener: (callback) => {
          listeners.onInstalled = callback;
        },
      },
      onStartup: {
        addListener: (callback) => {
          listeners.onStartup = callback;
        },
      },
    },
    tabs: {
      onRemoved: {
        addListener: () => {},
      },
    },
  };

  return { calls, listeners };
}

runner.test('background helpers migrate config and update icons', async () => {
  const { calls } = installBackgroundChromeMock();
  const background = await import('../../../src/background.ts');

  await background.updateIcon(false);
  await background.initializeIcon();
  await background.migrateConfig();

  assert.equal(calls.setIcon.length >= 2, true);
  assert.deepEqual(calls.setStorage[0], {
    siteProfiles: { 'example.com': { speed: 1.5 } },
  });
  assert.equal(calls.removeStorage.length >= 2, true);
});

export { runner as backgroundTestRunner };
