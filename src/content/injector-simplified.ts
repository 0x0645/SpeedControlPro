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
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || !event.data?.source?.startsWith('vsc-')) {
      return;
    }

    const { source, action, data } = event.data;

    if (source === 'vsc-page') {
      if (action === 'storage-update') {
        chrome.storage.sync.set(data);
      } else if (action === 'runtime-message') {
        chrome.runtime.sendMessage(data);
      } else if (action === 'get-storage') {
        chrome.storage.sync.get(null, (items: Record<string, unknown>) => {
          window.postMessage({ source: 'vsc-content', action: 'storage-data', data: items }, '*');
        });
      }
    }
  });

  chrome.runtime.onMessage.addListener(
    (request: any, _sender: unknown, sendResponse: (payload: unknown) => void) => {
      window.dispatchEvent(new CustomEvent('VSC_MESSAGE', { detail: request }));

      if (request.action === 'get-status') {
        const responseHandler = (event: MessageEvent) => {
          if (event.data?.source === 'vsc-page' && event.data?.action === 'status-response') {
            window.removeEventListener('message', responseHandler);
            sendResponse(event.data.data);
          }
        };
        window.addEventListener('message', responseHandler);
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
        window.postMessage(
          { source: 'vsc-content', action: 'storage-changed', data: changedData },
          '*'
        );
      }
    }
  );
}
