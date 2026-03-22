import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { wait } from '../../helpers/test-utils';
import { JSDOM } from 'jsdom';

const { BRIDGE_ACTIONS, BRIDGE_SOURCES, MESSAGE_TYPES } =
  await import('../../../src/utils/message-types');

const { setupMessageBridge, __resetBridgeForTests } =
  await import('../../../src/content/injection-bridge');

const originalGlobals = {
  window: global.window,
  document: global.document,
  Event: global.Event,
  CustomEvent: global.CustomEvent,
  MessageEvent: global.MessageEvent,
};

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MessageEvent: dom.window.MessageEvent,
  });

  return dom;
}

function createChromeMock() {
  const listeners = {
    runtimeMessage: [],
    storageChanged: [],
    runtimeSendMessage: [],
    storageSet: [],
  };

  return {
    listeners,
    chrome: {
      runtime: {
        getURL: (path) => `chrome-extension://test/${path}`,
        sendMessage: (payload) => {
          listeners.runtimeSendMessage.push(payload);
        },
        onMessage: {
          addListener: (callback) => {
            listeners.runtimeMessage.push(callback);
          },
        },
      },
      storage: {
        sync: {
          set: (payload) => {
            listeners.storageSet.push(payload);
          },
          get: (_defaults, callback) => {
            callback({ lastSpeed: 1.25 });
          },
        },
        onChanged: {
          addListener: (callback) => {
            listeners.storageChanged.push(callback);
          },
        },
      },
    },
  };
}

describe('InjectionBridge', () => {
  beforeEach(() => {
    __resetBridgeForTests();
    global.__bridgeTestDom = installDom();
    window.VSC = {};
  });

  afterEach(() => {
    delete global.chrome;
    global.__bridgeTestDom.window.close();
    delete global.__bridgeTestDom;
    Object.assign(global, originalGlobals);
  });

  it('setupMessageBridge registers listeners only once', () => {
    const { chrome, listeners } = createChromeMock();
    global.chrome = chrome;

    setupMessageBridge();
    setupMessageBridge();

    expect(listeners.runtimeMessage.length).toBe(1);
    expect(listeners.storageChanged.length).toBe(1);
  });

  it('bridge forwards popup site info requests back to sendResponse', async () => {
    const { chrome, listeners } = createChromeMock();
    global.chrome = chrome;

    setupMessageBridge();

    let responsePayload = null;
    const keepChannelOpen = listeners.runtimeMessage[0](
      { type: MESSAGE_TYPES.GET_SITE_INFO },
      null,
      (payload) => {
        responsePayload = payload;
      }
    );

    expect(keepChannelOpen).toBe(true);

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: BRIDGE_SOURCES.PAGE,
          action: BRIDGE_ACTIONS.CURRENT_SPEED_RESPONSE,
          data: { speed: 1.75, hostname: 'example.com' },
        },
      })
    );

    await wait(0);

    expect(responsePayload).toEqual({ speed: 1.75, hostname: 'example.com' });
  });

  it('bridge forwards sync storage changes to page context', () => {
    const { chrome, listeners } = createChromeMock();
    global.chrome = chrome;

    const postedMessages = [];
    const originalPostMessage = window.postMessage;
    window.postMessage = (payload) => {
      postedMessages.push(payload);
    };

    try {
      setupMessageBridge();

      listeners.storageChanged[0](
        {
          lastSpeed: { oldValue: 1, newValue: 1.5 },
          rememberSpeed: { oldValue: false, newValue: true },
        },
        'sync'
      );

      expect(postedMessages[0]).toEqual({
        source: BRIDGE_SOURCES.CONTENT,
        action: BRIDGE_ACTIONS.STORAGE_CHANGED,
        data: {
          lastSpeed: 1.5,
          rememberSpeed: true,
        },
      });
    } finally {
      window.postMessage = originalPostMessage;
    }
  });

  it('bridge does not forward internal state updates to runtime', () => {
    const { chrome, listeners } = createChromeMock();
    global.chrome = chrome;

    setupMessageBridge();

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: BRIDGE_SOURCES.PAGE,
          action: BRIDGE_ACTIONS.RUNTIME_MESSAGE,
          data: { type: MESSAGE_TYPES.STATE_UPDATE },
        },
      })
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: BRIDGE_SOURCES.PAGE,
          action: BRIDGE_ACTIONS.RUNTIME_MESSAGE,
          data: { type: MESSAGE_TYPES.SET_SPEED, payload: { speed: 2 } },
        },
      })
    );

    expect(listeners.runtimeSendMessage.length).toBe(1);
    expect(listeners.runtimeSendMessage[0]).toEqual({
      type: MESSAGE_TYPES.SET_SPEED,
      payload: { speed: 2 },
    });
  });
});
