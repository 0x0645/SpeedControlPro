import { SimpleTestRunner, assert } from '../../helpers/test-utils.js';

await import('../../../src/utils/message-types.ts');
await import('../../../src/utils/constants.ts');
await import('../../../src/utils/logger.ts');
await import('../../../src/core/storage-manager.ts');

const runner = new SimpleTestRunner();

const { BRIDGE_ACTIONS, BRIDGE_SOURCES } = await import('../../../src/utils/message-types.ts');

let originalChrome;

runner.beforeEach(() => {
  originalChrome = global.chrome;
  delete global.chrome;
  window.VSC.StorageManager.__resetForTests();
  window.VSC = window.VSC || {};
  window.VSC.logger = window.VSC.logger || { debug() {}, error() {} };
});

runner.afterEach(() => {
  if (typeof originalChrome !== 'undefined') {
    global.chrome = originalChrome;
  }
  window.VSC.StorageManager.__resetForTests();
});

runner.test('StorageManager.get loads injected page settings from DOM once', async () => {
  const el = document.createElement('script');
  el.id = 'vsc-settings-data';
  el.type = 'application/json';
  el.textContent = JSON.stringify({ lastSpeed: 1.5, rememberSpeed: true });
  document.body.appendChild(el);

  const result = await window.VSC.StorageManager.get({ lastSpeed: 1.0, enabled: true });

  assert.deepEqual(result, { lastSpeed: 1.5, enabled: true, rememberSpeed: true });
  assert.equal(document.getElementById('vsc-settings-data'), null);
  assert.equal(window.VSC_settings.lastSpeed, 1.5);
});

runner.test('StorageManager.set posts storage updates and merges page cache', async () => {
  const posted = [];
  const originalPostMessage = window.postMessage;
  window.VSC_settings = { lastSpeed: 1.25, rememberSpeed: false };
  window.postMessage = (payload) => {
    posted.push(payload);
  };

  try {
    await window.VSC.StorageManager.set({ rememberSpeed: true, audioBoolean: true });

    assert.deepEqual(posted[0], {
      source: BRIDGE_SOURCES.PAGE,
      action: BRIDGE_ACTIONS.STORAGE_UPDATE,
      data: { rememberSpeed: true, audioBoolean: true },
    });
    assert.deepEqual(window.VSC_settings, {
      lastSpeed: 1.25,
      rememberSpeed: true,
      audioBoolean: true,
    });
  } finally {
    window.postMessage = originalPostMessage;
  }
});

runner.test('StorageManager.remove and clear update page cache', async () => {
  window.VSC_settings = { lastSpeed: 1.25, rememberSpeed: true, audioBoolean: true };

  await window.VSC.StorageManager.remove(['rememberSpeed']);
  assert.deepEqual(window.VSC_settings, { lastSpeed: 1.25, audioBoolean: true });

  await window.VSC.StorageManager.clear();
  assert.deepEqual(window.VSC_settings, {});
});

runner.test('StorageManager.onChanged updates cache and notifies all page listeners', async () => {
  window.VSC_settings = { lastSpeed: 1.0, rememberSpeed: false };

  const calls = [];
  window.VSC.StorageManager.onChanged((changes) => {
    calls.push({ listener: 'first', changes });
  });
  window.VSC.StorageManager.onChanged((changes) => {
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

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].changes, {
    lastSpeed: { newValue: 1.75, oldValue: 1.0 },
    rememberSpeed: { newValue: true, oldValue: false },
  });
  assert.deepEqual(window.VSC_settings, { lastSpeed: 1.75, rememberSpeed: true });
});

export { runner as storageManagerTestRunner };
