import { describe, it, expect } from 'vitest';

describe('Popup Helpers', () => {
  it('chrome api helpers fall back to callback-style tab messaging', async () => {
    const originalChrome = global.chrome;

    global.chrome = {
      tabs: {
        query: (_queryInfo, callback) => callback([{ id: 12, url: 'https://example.com' }]),
        sendMessage: (_tabId, _message, callback) => callback({ speed: 1.5 }),
      },
      runtime: {
        lastError: null,
        sendMessage: (_message, callback) => callback(),
        openOptionsPage: (callback) => callback(),
      },
    };

    const { openOptionsPage, queryActiveTab, sendRuntimeMessage, sendTabMessage } =
      await import('../../../src/utils/chrome-api.ts');

    const tab = await queryActiveTab();
    const response = await sendTabMessage(12, { type: 'TEST' });
    await sendRuntimeMessage({ type: 'PING' });
    await openOptionsPage();

    expect(tab.id).toBe(12);
    expect(response.speed).toBe(1.5);

    global.chrome = originalChrome;
  });

  it('chrome api helpers treat missing receivers as undefined', async () => {
    const originalChrome = global.chrome;

    global.chrome = {
      tabs: {
        query: async () => [{ id: 7, url: 'https://example.com' }],
        sendMessage: async () => {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        },
      },
      runtime: {
        lastError: null,
        sendMessage: async () => undefined,
        openOptionsPage: async () => undefined,
      },
    };

    const { sendTabMessage } = await import('../../../src/utils/chrome-api.ts');
    const response = await sendTabMessage(7, { type: 'TEST' });

    expect(response).toBe(undefined);

    global.chrome = originalChrome;
  });
});
