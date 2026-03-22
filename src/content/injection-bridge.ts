import {
  BRIDGE_ACTIONS,
  BRIDGE_SOURCES,
  EXTENSION_MESSAGES,
  MESSAGE_TYPES,
} from '../utils/message-types';
import { getFromChromeStorage, setInChromeStorage } from '../core/chrome-storage-adapter';
import { sendRuntimeMessage } from '../utils/chrome-api';
import type { RuntimeMessage, StorageChangeMap, StorageSnapshot } from '../types/contracts';

let bridgeInitialized = false;

type BridgeRuntimeRequest = RuntimeMessage | { action: 'get-status' };

function isRuntimeMessage(payload: unknown): payload is RuntimeMessage {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    typeof (payload as { type?: unknown }).type === 'string' &&
    (payload as { type: string }).type.startsWith('VSC_')
  );
}

function isBridgeStatusRequest(payload: unknown): payload is { action: 'get-status' } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'action' in payload &&
    (payload as { action?: unknown }).action === 'get-status'
  );
}

function flattenStorageChanges(changes: StorageChangeMap): StorageSnapshot {
  const changedData: StorageSnapshot = {};
  for (const [key, value] of Object.entries(changes)) {
    changedData[key] = value?.newValue;
  }
  return changedData;
}

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
      void (async () => {
        if (action === BRIDGE_ACTIONS.STORAGE_UPDATE) {
          const update = data as StorageSnapshot;
          if (typeof update.lastSpeed === 'number' && Number.isFinite(update.lastSpeed)) {
            await sendRuntimeMessage({
              type: EXTENSION_MESSAGES.TAB_SPEED_UPDATE,
              lastSpeed: update.lastSpeed,
            });
          }
          await setInChromeStorage(update);
        } else if (action === BRIDGE_ACTIONS.RUNTIME_MESSAGE && isRuntimeMessage(data)) {
          if (data.type !== MESSAGE_TYPES.STATE_UPDATE) {
            await sendRuntimeMessage(data);
          }
        } else if (action === BRIDGE_ACTIONS.GET_STORAGE) {
          const items = await getFromChromeStorage();
          postToPage(BRIDGE_ACTIONS.STORAGE_DATA, items);
        }
      })();
    }
  });

  chrome.runtime.onMessage.addListener(
    (request: BridgeRuntimeRequest, _sender: unknown, sendResponse: (payload: unknown) => void) => {
      window.dispatchEvent(
        new CustomEvent('VSC_MESSAGE', {
          detail: request,
        })
      );

      if (isRuntimeMessage(request) && request.type === MESSAGE_TYPES.GET_SITE_INFO) {
        waitForPageResponse(BRIDGE_ACTIONS.CURRENT_SPEED_RESPONSE, sendResponse);
        return true;
      }

      if (isBridgeStatusRequest(request)) {
        waitForPageResponse(BRIDGE_ACTIONS.STATUS_RESPONSE, sendResponse);
        return true;
      }

      return undefined;
    }
  );

  chrome.storage.onChanged.addListener((changes: StorageChangeMap, namespace: string) => {
    if (namespace === 'sync') {
      postToPage(BRIDGE_ACTIONS.STORAGE_CHANGED, flattenStorageChanges(changes));
    }
  });
}
