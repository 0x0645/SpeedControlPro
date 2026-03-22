import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { wait } from '../../helpers/test-utils';
import { JSDOM } from 'jsdom';

const { BRIDGE_ACTIONS, BRIDGE_SOURCES, MESSAGE_TYPES } =
  await import('../../../src/utils/message-types');

const { setupMessageBridge, __resetBridgeForTests } =
  await import('../../../src/content/injection-bridge');

declare global {
  let __bridgeTestDom: JSDOM;
}

const g = globalThis as typeof globalThis & {
  window: typeof window;
  document: Document;
  Event: typeof Event;
  CustomEvent: typeof CustomEvent;
  MessageEvent: typeof MessageEvent;
  chrome?: typeof chrome;
  __bridgeTestDom?: JSDOM;
};

const originalGlobals = {
  window: g.window,
  document: g.document,
  Event: g.Event,
  CustomEvent: g.CustomEvent,
  MessageEvent: g.MessageEvent,
};

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  Object.assign(g, {
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MessageEvent: dom.window.MessageEvent,
  });

  return dom;
}

interface BridgeTestListeners {
  runtimeMessage: Array<
    (message: unknown, _sender: unknown, sendResponse: (payload: unknown) => void) => boolean
  >;
  storageChanged: Array<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void>;
  runtimeSendMessage: unknown[];
  storageSet: unknown[];
}

function createChromeMock(): {
  listeners: BridgeTestListeners;
  chrome: typeof chrome;
} {
  const listeners: BridgeTestListeners = {
    runtimeMessage: [],
    storageChanged: [],
    runtimeSendMessage: [],
    storageSet: [],
  };

  return {
    listeners,
    chrome: {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        sendMessage: (payload: unknown) => {
          listeners.runtimeSendMessage.push(payload);
        },
        onMessage: {
          addListener: (
            callback: (
              message: unknown,
              sender: unknown,
              sendResponse: (payload: unknown) => void
            ) => boolean
          ) => {
            listeners.runtimeMessage.push(callback);
          },
        },
      },
      storage: {
        sync: {
          set: (payload: unknown) => {
            listeners.storageSet.push(payload);
          },
          get: (
            _defaults: Record<string, unknown>,
            callback: (result: Record<string, unknown>) => void
          ) => {
            callback({ lastSpeed: 1.25 });
          },
        },
        onChanged: {
          addListener: (
            callback: (
              changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
              areaName: string
            ) => void
          ) => {
            listeners.storageChanged.push(callback);
          },
        },
      },
    } as typeof chrome,
  };
}

describe('InjectionBridge', () => {
  beforeEach(() => {
    __resetBridgeForTests();
    g.__bridgeTestDom = installDom();
    (g.window as typeof window & { VSC?: unknown }).VSC = {};
  });

  afterEach(() => {
    Reflect.deleteProperty(g, 'chrome');
    g.__bridgeTestDom!.window.close();
    Reflect.deleteProperty(g, '__bridgeTestDom');
    Object.assign(g, originalGlobals);
  });

  it('setupMessageBridge registers listeners only once', () => {
    const { chrome: chromeMock, listeners } = createChromeMock();
    g.chrome = chromeMock;

    setupMessageBridge();
    setupMessageBridge();

    expect(listeners.runtimeMessage.length).toBe(1);
    expect(listeners.storageChanged.length).toBe(1);
  });

  it('bridge forwards popup site info requests back to sendResponse', async () => {
    const { chrome: chromeMock, listeners } = createChromeMock();
    g.chrome = chromeMock;

    setupMessageBridge();

    let responsePayload: unknown = null;
    const keepChannelOpen = listeners.runtimeMessage[0]!(
      { type: MESSAGE_TYPES.GET_SITE_INFO },
      null,
      (payload: unknown) => {
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
    const { chrome: chromeMock, listeners } = createChromeMock();
    g.chrome = chromeMock;

    const postedMessages: unknown[] = [];
    const originalPostMessage = window.postMessage;
    window.postMessage = (payload: unknown) => {
      postedMessages.push(payload);
    };

    try {
      setupMessageBridge();

      listeners.storageChanged[0]!(
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
    const { chrome: chromeMock, listeners } = createChromeMock();
    g.chrome = chromeMock;

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
    expect(listeners.runtimeSendMessage[0]!).toEqual({
      type: MESSAGE_TYPES.SET_SPEED,
      payload: { speed: 2 },
    });
  });
});
