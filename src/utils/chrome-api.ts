export type ChromeTabLike = {
  id?: number;
  url?: string;
};

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as Promise<T>).then === 'function';
}

function getRuntimeErrorMessage(): string | null {
  return chrome.runtime.lastError?.message || null;
}

export async function queryActiveTab<T extends ChromeTabLike = ChromeTabLike>(): Promise<T | null> {
  const tabsApi = chrome.tabs;
  const queryMethod = tabsApi.query;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (tabs: T[]) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(tabs[0] || null);
    };

    const result = queryMethod.call(tabsApi, { active: true, currentWindow: true }, (tabs: T[]) => {
      finish(tabs);
    });

    if (isPromiseLike<T[]>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}

export async function sendTabMessage<T>(tabId: number, message: object): Promise<T | undefined> {
  const tabsApi = chrome.tabs;
  const sendMethod = tabsApi.sendMessage;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (response: T | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(response);
    };

    const handleError = (runtimeError: string) => {
      if (
        runtimeError.includes('Receiving end does not exist') ||
        runtimeError.includes('message port closed')
      ) {
        finish(undefined);
        return;
      }
      reject(new Error(runtimeError));
    };

    const result = sendMethod.call(tabsApi, tabId, message, (response: T) => {
      const runtimeError = getRuntimeErrorMessage();
      if (runtimeError) {
        handleError(runtimeError);
        return;
      }

      finish(response);
    });

    if (isPromiseLike<T>(result)) {
      void result
        .then((response) => finish(response))
        .catch((error) => {
          const messageText = error instanceof Error ? error.message : String(error);
          if (
            messageText.includes('Receiving end does not exist') ||
            messageText.includes('message port closed')
          ) {
            finish(undefined);
            return;
          }
          reject(error instanceof Error ? error : new Error(messageText));
        });
    }
  });
}

export async function sendRuntimeMessage(message: object): Promise<void> {
  const runtimeApi = chrome.runtime;
  const sendMethod = runtimeApi.sendMessage;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const result = sendMethod.call(runtimeApi, message, () => {
      const runtimeError = getRuntimeErrorMessage();
      if (runtimeError) {
        reject(new Error(runtimeError));
        return;
      }

      finish();
    });

    if (isPromiseLike<void>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}

export async function openOptionsPage(): Promise<void> {
  const runtimeApi = chrome.runtime;
  const openMethod = runtimeApi.openOptionsPage;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const result = openMethod.call(runtimeApi, () => {
      const runtimeError = getRuntimeErrorMessage();
      if (runtimeError) {
        reject(new Error(runtimeError));
        return;
      }

      finish();
    });

    if (isPromiseLike<void>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}
