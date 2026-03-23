function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as Promise<T>).then === 'function';
}

export async function getFromChromeSessionStorage<T extends Record<string, unknown>>(
  defaults: T
): Promise<T> {
  const storageArea = chrome.storage.session;
  const getMethod = storageArea.get;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (storage: T) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(storage);
    };

    const result = getMethod.call(storageArea, defaults, (storage: T) => {
      finish(storage);
    });

    if (isPromiseLike<T>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}

export async function setInChromeSessionStorage<T extends Record<string, unknown>>(
  data: T
): Promise<void> {
  const storageArea = chrome.storage.session;
  const setMethod = storageArea.set;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const result = setMethod.call(storageArea, data, finish);
    if (isPromiseLike<void>(result)) {
      void result.then(finish).catch(reject);
    }
  });
}
