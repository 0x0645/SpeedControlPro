import { vi, beforeEach } from 'vitest';

// ── Chrome API mock ──────────────────────────────────────────────────

const defaultStorage: Record<string, unknown> = {
  enabled: true,
  lastSpeed: 1.0,
  keyBindings: [],
  rememberSpeed: false,
  forceLastSavedSpeed: false,
  audioBoolean: false,
  startHidden: false,
  controllerOpacity: 0.3,
  controllerButtonSize: 14,
  blacklist: 'www.instagram.com\nx.com',
  logLevel: 3,
  siteProfiles: {},
};

let mockStorage: Record<string, unknown> = { ...defaultStorage };

export function resetMockStorage() {
  mockStorage = { ...defaultStorage };
}

export function getMockStorage() {
  return mockStorage;
}

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn((keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
        const result =
          typeof keys === 'object' && keys !== null && !Array.isArray(keys)
            ? Object.keys(keys as Record<string, unknown>).reduce(
                (acc: Record<string, unknown>, key: string) => {
                  acc[key] =
                    mockStorage[key] !== undefined
                      ? mockStorage[key]
                      : (keys as Record<string, unknown>)[key];
                  return acc;
                },
                {}
              )
            : { ...mockStorage };
        if (callback) {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(mockStorage, items);
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach((k) => delete mockStorage[k]);
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
      clear: vi.fn((callback?: () => void) => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
    },
    session: {
      get: vi.fn((keys: unknown, callback?: (r: unknown) => void) => {
        const result = typeof keys === 'object' && keys !== null ? { ...keys } : {};
        if (callback) {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((_data: unknown, callback?: () => void) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-extension/${path}`),
    id: 'test-extension-id',
    lastError: null as { message: string } | null,
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn((_msg: unknown, callback?: () => void) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }),
  },
  tabs: {
    query: vi.fn(
      (
        _q: unknown,
        callback?: (tabs: Array<{ id: number; active: boolean; url: string }>) => void
      ) => {
        const tabs = [{ id: 1, active: true, url: 'https://www.youtube.com/watch?v=test' }];
        if (callback) {
          callback(tabs);
        }
        return Promise.resolve(tabs);
      }
    ),
    sendMessage: vi.fn((_tabId: number, _msg: unknown, callback?: (response: unknown) => void) => {
      if (callback) {
        setTimeout(() => callback({}), 0);
      }
      return Promise.resolve({});
    }),
  },
  action: {
    setIcon: vi.fn(async () => {}),
  },
};

vi.stubGlobal('chrome', chromeMock);

// ── DOM globals ──────────────────────────────────────────────────────

// JSDOM is set up by vitest environment: 'jsdom', but we need window.VSC
(window as any).VSC = (window as any).VSC || {};
(window as any).VSC_settings = null;

// Mock requestIdleCallback if not available
if (typeof (globalThis as any).requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = (fn: () => void) => setTimeout(fn, 0);
}

// ── Shadow DOM polyfill ──────────────────────────────────────────────

if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.attachShadow) {
  (HTMLElement.prototype as any).attachShadow = function (options: { mode?: string }) {
    const shadowRoot = document.createElement('div');
    (shadowRoot as any).mode = options.mode || 'open';
    (shadowRoot as any).host = this;

    let shadowHTML = '';
    Object.defineProperty(shadowRoot, 'innerHTML', {
      get: () => shadowHTML,
      set: (value: string) => {
        shadowHTML = value;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = value.replace(/@import[^;]+;/g, '');
        while (tempDiv.firstChild) {
          shadowRoot.appendChild(tempDiv.firstChild);
        }
      },
    });

    (this as any).shadowRoot = shadowRoot;
    return shadowRoot;
  };
}

// ── Auto-reset between tests ─────────────────────────────────────────

beforeEach(() => {
  resetMockStorage();
  vi.restoreAllMocks();
  // Re-stub chrome since restoreAllMocks clears vi.fn() implementations
  vi.stubGlobal('chrome', chromeMock);

  // Re-apply default implementations after restore
  chromeMock.storage.sync.get.mockImplementation(
    (keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
      const result =
        typeof keys === 'object' && keys !== null && !Array.isArray(keys)
          ? Object.keys(keys as Record<string, unknown>).reduce(
              (acc: Record<string, unknown>, key: string) => {
                acc[key] =
                  mockStorage[key] !== undefined
                    ? mockStorage[key]
                    : (keys as Record<string, unknown>)[key];
                return acc;
              },
              {}
            )
          : { ...mockStorage };
      if (callback) {
        setTimeout(() => callback(result), 0);
      }
      return Promise.resolve(result);
    }
  );

  chromeMock.storage.sync.set.mockImplementation(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(mockStorage, items);
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }
  );

  chromeMock.storage.sync.remove.mockImplementation(
    (keys: string | string[], callback?: () => void) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach((k) => delete mockStorage[k]);
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }
  );

  chromeMock.storage.sync.clear.mockImplementation((callback?: () => void) => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return Promise.resolve();
  });

  chromeMock.runtime.lastError = null;
  chromeMock.runtime.getURL.mockImplementation(
    (path: string) => `chrome-extension://test-extension/${path}`
  );
  chromeMock.runtime.sendMessage.mockImplementation((_msg: unknown, callback?: () => void) => {
    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return Promise.resolve();
  });
  chromeMock.tabs.query.mockImplementation(
    (
      _q: unknown,
      callback?: (tabs: Array<{ id: number; active: boolean; url: string }>) => void
    ) => {
      const tabs = [{ id: 1, active: true, url: 'https://www.youtube.com/watch?v=test' }];
      if (callback) {
        callback(tabs);
      }
      return Promise.resolve(tabs);
    }
  );
  chromeMock.tabs.sendMessage.mockImplementation(
    (_tabId: number, _msg: unknown, callback?: (response: unknown) => void) => {
      if (callback) {
        setTimeout(() => callback({}), 0);
      }
      return Promise.resolve({});
    }
  );
  chromeMock.action.setIcon.mockImplementation(async () => {});
  chromeMock.storage.session.get.mockImplementation(
    (keys: unknown, callback?: (r: unknown) => void) => {
      const result = typeof keys === 'object' && keys !== null ? { ...keys } : {};
      if (callback) {
        setTimeout(() => callback(result), 0);
      }
      return Promise.resolve(result);
    }
  );
  chromeMock.storage.session.set.mockImplementation((_data: unknown, callback?: () => void) => {
    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return Promise.resolve();
  });
});
