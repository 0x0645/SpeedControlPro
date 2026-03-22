import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { JSDOM } from 'jsdom';
import { wait } from '../../helpers/test-utils';

function installPopupChromeMock() {
  const calls = {
    syncSet: [],
    sentMessages: [],
    runtimeMessages: [],
    openOptions: 0,
  };

  let currentSpeed = 1.6;
  let siteProfiles = {};

  global.chrome = {
    storage: {
      sync: {
        get: (defaults, callback) => {
          const data = {
            enabled: true,
            lastSpeed: 1.25,
            keyBindings: [
              { action: 'slower', key: 83, value: 0.1, predefined: true },
              { action: 'faster', key: 68, value: 0.1, predefined: true },
              { action: 'fast', key: 71, value: 1.8, predefined: true },
            ],
            siteProfiles,
            ...defaults,
          };
          callback(data);
        },
        set: (payload, callback) => {
          calls.syncSet.push(payload);
          if (payload.siteProfiles) {
            siteProfiles = payload.siteProfiles;
          }
          callback?.();
        },
      },
      session: {
        get: (_defaults, callback) => callback({ tabSpeeds: { 1: 1.4 } }),
      },
    },
    tabs: {
      query: (_queryInfo, callback) => callback([{ id: 1, url: 'https://example.com/video' }]),
      sendMessage: (_tabId, message, callback) => {
        calls.sentMessages.push(message);

        if (message.type === 'VSC_ADJUST_SPEED') {
          currentSpeed = Number((currentSpeed + message.payload.delta).toFixed(2));
          callback?.();
          return;
        }

        if (message.type === 'VSC_SET_SPEED') {
          currentSpeed = message.payload.speed;
          callback?.();
          return;
        }

        if (message.type === 'VSC_GET_SITE_INFO') {
          callback?.({
            speed: currentSpeed,
            hostname: 'example.com',
            hasProfile: !!siteProfiles['example.com'],
            profile: siteProfiles['example.com'] || null,
          });
          return;
        }

        callback?.();
      },
    },
    runtime: {
      lastError: null,
      sendMessage: (message, callback) => {
        calls.runtimeMessages.push(message);
        callback?.();
      },
      openOptionsPage: (callback) => {
        calls.openOptions += 1;
        callback?.();
      },
      getURL: (path) => path,
    },
    action: {
      setIcon: () => Promise.resolve(),
    },
  };

  return { calls };
}

describe('Popup Module', () => {
  it('popup module updates speed display and saves current site speed', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://extension.test/popup.html',
      pretendToBeVisual: true,
    });

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      Element: dom.window.Element,
      Node: dom.window.Node,
      Event: dom.window.Event,
      CustomEvent: dom.window.CustomEvent,
      KeyboardEvent: dom.window.KeyboardEvent,
      MutationObserver: dom.window.MutationObserver,
      customElements: dom.window.customElements,
    });

    const html = await readFile('./src/ui/popup/popup.html', 'utf8');
    document.documentElement.innerHTML = html;
    const { calls } = installPopupChromeMock();

    await import('../../../src/ui/popup/popup');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await wait(20);
    expect(document.getElementById('speed-display').textContent.trim()).toBe('1.60');

    document.getElementById('speed-increase').click();
    await wait(180);
    expect(document.getElementById('speed-display').textContent.trim()).toBe('1.70');

    document.getElementById('site-speed-toggle').click();
    await wait(30);

    const lastSyncSet = calls.syncSet[calls.syncSet.length - 1];
    expect(lastSyncSet.siteProfiles['example.com'].speed).toBe(1.7);
    expect(calls.sentMessages.some((message) => message.type === 'VSC_ADJUST_SPEED')).toBe(true);
  });
});
