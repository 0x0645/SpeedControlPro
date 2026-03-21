import {
  BRIDGE_ACTIONS,
  BRIDGE_SOURCES,
  EXTENSION_MESSAGES,
  MESSAGE_TYPES,
} from '../utils/message-types';

let bridgeInitialized = false;

export function __resetBridgeForTests(): void {
  bridgeInitialized = false;
}

function postToPage(action: string, data: unknown): void {
  window.postMessage(
    {
      source: BRIDGE_SOURCES.CONTENT,
      action,
      data,
    },
    '*'
  );
}

function waitForPageResponse(
  expectedAction: string,
  sendResponse: (payload: unknown) => void,
  timeoutMs = 2000
): void {
  let resolved = false;

  const cleanup = () => {
    window.removeEventListener('message', responseHandler);
    globalThis.clearTimeout(timeoutId);
  };

  const settle = (payload: unknown) => {
    if (resolved) {
      return;
    }

    resolved = true;
    cleanup();
    sendResponse(payload);
  };

  const responseHandler = (event: MessageEvent) => {
    if (
      event.source === window &&
      event.data?.source === BRIDGE_SOURCES.PAGE &&
      event.data?.action === expectedAction
    ) {
      settle(event.data.data);
    }
  };

  const timeoutId = globalThis.setTimeout(() => {
    settle(null);
  }, timeoutMs);

  window.addEventListener('message', responseHandler);
}

export async function injectScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptPath);
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load script: ${scriptPath}`));
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

export function setupMessageBridge(): void {
  if (bridgeInitialized) {
    return;
  }

  bridgeInitialized = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || !event.data?.source?.startsWith('vsc-')) {
      return;
    }

    const { source, action, data } = event.data;

    if (source === BRIDGE_SOURCES.PAGE) {
      if (action === BRIDGE_ACTIONS.STORAGE_UPDATE) {
        const update = data as Record<string, unknown>;
        if (
          typeof update.lastSpeed === 'number' &&
          Number.isFinite(update.lastSpeed)
        ) {
          chrome.runtime.sendMessage({
            type: EXTENSION_MESSAGES.TAB_SPEED_UPDATE,
            lastSpeed: update.lastSpeed,
          });
        }
        chrome.storage.sync.set(update);
      } else if (action === BRIDGE_ACTIONS.RUNTIME_MESSAGE) {
        if (data.type !== MESSAGE_TYPES.STATE_UPDATE) {
          chrome.runtime.sendMessage(data);
        }
      } else if (action === BRIDGE_ACTIONS.GET_STORAGE) {
        chrome.storage.sync.get(null, (items: Record<string, unknown>) => {
          postToPage(BRIDGE_ACTIONS.STORAGE_DATA, items);
        });
      }
    }
  });

  chrome.runtime.onMessage.addListener(
    (request: Record<string, unknown>, _sender: unknown, sendResponse: (payload: unknown) => void) => {
      window.dispatchEvent(
        new CustomEvent('VSC_MESSAGE', {
          detail: request,
        })
      );

      if (request.type === MESSAGE_TYPES.GET_SITE_INFO) {
        waitForPageResponse(BRIDGE_ACTIONS.CURRENT_SPEED_RESPONSE, sendResponse);
        return true;
      }

      if (request.action === 'get-status') {
        waitForPageResponse(BRIDGE_ACTIONS.STATUS_RESPONSE, sendResponse);
        return true;
      }

      return undefined;
    }
  );

  chrome.storage.onChanged.addListener(
    (changes: Record<string, { newValue?: unknown }>, namespace: string) => {
      if (namespace === 'sync') {
        const changedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(changes)) {
          changedData[key] = value?.newValue;
        }
        postToPage(BRIDGE_ACTIONS.STORAGE_CHANGED, changedData);
      }
    }
  );
}
