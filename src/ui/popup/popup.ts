import { EXTENSION_MESSAGES, MESSAGE_TYPES } from '../../utils/message-types';
import { getFromChromeSessionStorage } from '../../core/chrome-session-adapter';
import { getFromChromeStorage, setInChromeStorage } from '../../core/chrome-storage-adapter';
import {
  openOptionsPage,
  queryActiveTab,
  sendRuntimeMessage,
  sendTabMessage,
} from '../../utils/chrome-api';
import { normalizeHostname } from '../../utils/hostname';
import type { SiteInfoResponse } from '../../types/contracts';
import type { KeyBinding, SiteProfile } from '../../types/settings';

let preferredSpeed = 1.0;
let currentSpeed = 1.0;
let activeHostname = '';
let activeSiteProfile: SiteProfile | undefined;
let statusTimeout: number | undefined;

type PopupStorage = {
  enabled?: boolean;
  lastSpeed?: number;
  keyBindings?: KeyBinding[];
  siteProfiles?: Record<string, SiteProfile>;
};

async function getSyncStorage(defaults: PopupStorage = {}): Promise<PopupStorage> {
  return getFromChromeStorage(defaults);
}

async function setSyncStorage(data: PopupStorage): Promise<void> {
  await setInChromeStorage(data);
}

async function getSessionStorage<T>(defaults: T): Promise<T> {
  return getFromChromeSessionStorage(defaults as T & Record<string, unknown>) as Promise<T>;
}

async function sendTabRuntimeMessage<T>(tabId: number, message: object): Promise<T | undefined> {
  return sendTabMessage<T>(tabId, message);
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function query<T extends Element>(selector: string): T {
  return document.querySelector(selector) as T;
}

function getProfileOverrideCount(profile?: SiteProfile): number {
  if (!profile) {
    return 0;
  }

  let count = 0;

  if (profile.speed !== undefined) {
    count += 1;
  }
  if (profile.startHidden !== undefined) {
    count += 1;
  }
  if (profile.audioBoolean !== undefined) {
    count += 1;
  }
  if (profile.controllerOpacity !== undefined) {
    count += 1;
  }
  if (profile.controllerButtonSize !== undefined) {
    count += 1;
  }
  if (Array.isArray(profile.keyBindings) && profile.keyBindings.length > 0) {
    count += 1;
  }

  return count;
}

function hasCustomProfileSettings(profile?: SiteProfile): boolean {
  return getProfileOverrideCount(profile) > 0;
}

export function getProfileLabel(profile?: SiteProfile): string {
  if (!profile || !hasCustomProfileSettings(profile)) {
    return 'Profile active';
  }

  if (profile.speed !== undefined) {
    return `Saved (${profile.speed}x)`;
  }

  if (Array.isArray(profile.keyBindings) && profile.keyBindings.length > 0) {
    return `${profile.keyBindings.length} shortcut${profile.keyBindings.length === 1 ? '' : 's'}`;
  }

  return 'Profile active';
}

function getProfileSummary(profile?: SiteProfile): string {
  if (!profile) {
    return `Uses your global settings. Save ${currentSpeed.toFixed(2)}x here if this site should always open faster.`;
  }

  if (profile.speed !== undefined) {
    return `Saved to ${profile.speed}x for this site.${getProfileOverrideCount(profile) > 1 ? ' Other site-specific rules are also active.' : ''}`;
  }

  return `${getProfileOverrideCount(profile)} site-specific rule${getProfileOverrideCount(profile) === 1 ? '' : 's'} active here. Edit rules for deeper changes.`;
}

function getPrimaryProfileButtonLabel(profile?: SiteProfile): string {
  if (profile?.speed !== undefined) {
    return `Update saved speed to ${currentSpeed.toFixed(2)}x`;
  }

  if (profile) {
    return `Add ${currentSpeed.toFixed(2)}x to this profile`;
  }

  return `Save ${currentSpeed.toFixed(2)}x for this site`;
}

function updateSiteProfileUI(profile?: SiteProfile): void {
  const summaryEl = byId<HTMLElement>('site-profile-summary');
  const saveBtn = byId<HTMLButtonElement>('site-speed-toggle');
  const clearBtn = byId<HTMLButtonElement>('site-profile-clear');
  const sitePanel = query<HTMLElement>('.site-panel');

  const hasProfile = profile !== undefined;
  const savedSpeed = profile?.speed;

  summaryEl.textContent = getProfileSummary(profile);

  saveBtn.textContent = getPrimaryProfileButtonLabel(profile);
  saveBtn.title = getPrimaryProfileButtonLabel(profile);
  saveBtn.classList.toggle('saved', savedSpeed !== undefined);
  clearBtn.classList.toggle('hide', !hasProfile);
  clearBtn.title = hasProfile ? 'Use global rules for this site' : 'Use global rules';

  if (sitePanel) {
    sitePanel.classList.toggle('has-profile', hasProfile);
  }
}

function setStatusMessage(str: string, kind?: 'success' | 'error'): void {
  const el = query<HTMLElement>('#status');
  if (statusTimeout) {
    globalThis.clearTimeout(statusTimeout);
  }
  el.classList.toggle('hide', false);
  el.classList.remove('success', 'error');
  if (kind) {
    el.classList.add(kind);
  }
  el.innerText = str;

  statusTimeout = globalThis.setTimeout(() => {
    el.classList.add('hide');
    el.classList.remove('success', 'error');
    el.innerText = '';
  }, 2400);
}

function refreshSiteProfileUI(): void {
  if (!activeHostname) {
    return;
  }

  updateSiteProfileUI(activeSiteProfile);
}

function setActiveSiteProfile(profile?: SiteProfile): void {
  activeSiteProfile = profile;
  refreshSiteProfileUI();
}

function reportPopupError(message: string, error: unknown): void {
  console.error(message, error);
  setStatusMessage(message, 'error');
}

document.addEventListener('DOMContentLoaded', () => {
  initializeSpeedControls();

  void loadSettingsAndInitialize().catch((error) => {
    reportPopupError('Could not load current speed.', error);
    updateSpeedUI(currentSpeed || 1.0);
  });

  void initializeSiteProfile().catch((error) => {
    reportPopupError('Could not load site profile.', error);
  });

  query<HTMLElement>('#config').addEventListener('click', () => {
    void openOptionsPage().catch((error) => {
      reportPopupError('Could not open settings.', error);
    });
  });

  query<HTMLElement>('#site-profile-edit').addEventListener('click', () => {
    void openOptionsPage().catch((error) => {
      reportPopupError('Could not open settings.', error);
    });
  });

  query<HTMLElement>('#disable').addEventListener('click', function () {
    const isCurrentlyEnabled = !this.classList.contains('disabled');
    void toggleEnabled(!isCurrentlyEnabled, settingsSavedReloadMessage).catch((error) => {
      reportPopupError('Could not update extension state.', error);
    });
  });

  void getSyncStorage({ enabled: true })
    .then((storage) => {
      toggleEnabledUI(storage.enabled !== false);
    })
    .catch((error) => {
      reportPopupError('Could not read extension state.', error);
      toggleEnabledUI(true);
    });

  async function toggleEnabled(
    enabled: boolean,
    callback?: (enabled: boolean) => void
  ): Promise<void> {
    await setSyncStorage({ enabled });
    toggleEnabledUI(enabled);
    if (callback) {
      callback(enabled);
    }
  }

  function toggleEnabledUI(enabled: boolean): void {
    const disableBtn = query<HTMLElement>('#disable');
    disableBtn.classList.toggle('disabled', !enabled);
    disableBtn.title = enabled ? 'Disable Extension' : 'Enable Extension';
    disableBtn.setAttribute('aria-pressed', String(!enabled));

    const suffix = enabled ? '' : '_disabled';
    chrome.action.setIcon({
      path: {
        19: chrome.runtime.getURL(`assets/icons/icon19${suffix}.png`),
        38: chrome.runtime.getURL(`assets/icons/icon38${suffix}.png`),
        48: chrome.runtime.getURL(`assets/icons/icon48${suffix}.png`),
      },
    });

    void sendRuntimeMessage({ type: EXTENSION_MESSAGES.TOGGLE, enabled }).catch((error) => {
      console.error('Failed to notify background about toggle:', error);
    });
  }

  function settingsSavedReloadMessage(enabled: boolean): void {
    setStatusMessage(
      `${enabled ? 'Enabled' : 'Disabled'}. Reload the page to update the site.`,
      'success'
    );
  }

  function updateSpeedUI(speed: number): void {
    currentSpeed = speed;

    const display = byId<HTMLElement>('speed-display');
    if (display) {
      display.textContent = Number(speed).toFixed(2);
    }

    document.querySelectorAll<HTMLElement>('.preset-btn').forEach((btn) => {
      const btnSpeed = parseFloat(btn.dataset.speed || '0');
      btn.classList.toggle('active', Math.abs(btnSpeed - speed) < 0.01);
    });

    refreshSiteProfileUI();
  }

  async function refreshSpeedFromTab(tabId: number, fallbackSpeed?: number): Promise<void> {
    const response = await sendTabRuntimeMessage<SiteInfoResponse>(tabId, {
      type: MESSAGE_TYPES.GET_SITE_INFO,
    });

    const resolvedSpeed =
      typeof response?.speed === 'number' && Number.isFinite(response.speed)
        ? response.speed
        : (fallbackSpeed ?? null);

    if (resolvedSpeed !== null) {
      updateSpeedUI(resolvedSpeed);
    }
  }

  function scheduleSpeedRefresh(tabId: number, fallbackSpeed?: number, delay = 120): void {
    globalThis.setTimeout(() => {
      void refreshSpeedFromTab(tabId, fallbackSpeed).catch((error) => {
        console.error('Failed to reconcile popup speed:', error);
      });
    }, delay);
  }

  function getEffectiveKeyBindings(
    storage: PopupStorage,
    hostname: string
  ): Array<{ action: string; value: number }> {
    const profiles = storage.siteProfiles || {};
    const key = normalizeHostname(hostname) || hostname;
    const profile = profiles[key] || profiles[hostname];
    const resolved =
      (profile && Array.isArray(profile.keyBindings) ? profile.keyBindings : null) ??
      (Array.isArray(storage.keyBindings) ? storage.keyBindings : []);
    return resolved;
  }

  async function loadSettingsAndInitialize(): Promise<void> {
    const activeTab = await queryActiveTab();
    let hostname = '';

    if (activeTab?.url) {
      try {
        const raw = new URL(activeTab.url).hostname;
        hostname = normalizeHostname(raw) || raw;
      } catch {
        hostname = '';
      }
    }

    const storage = await getSyncStorage();
    const keyBindings = getEffectiveKeyBindings(storage, hostname);

    let slowerStep = 0.1;
    let fasterStep = 0.1;

    const slowerBinding = keyBindings.find((kb) => kb.action === 'slower');
    const fasterBinding = keyBindings.find((kb) => kb.action === 'faster');
    const fastBinding = keyBindings.find((kb) => kb.action === 'fast');

    if (slowerBinding && typeof slowerBinding.value === 'number') {
      slowerStep = slowerBinding.value;
    }
    if (fasterBinding && typeof fasterBinding.value === 'number') {
      fasterStep = fasterBinding.value;
    }
    if (fastBinding && typeof fastBinding.value === 'number') {
      preferredSpeed = fastBinding.value;
    }

    const decreaseBtn = query<HTMLElement>('#speed-decrease');
    if (decreaseBtn) {
      decreaseBtn.dataset.delta = String(-slowerStep);
    }
    const increaseBtn = query<HTMLElement>('#speed-increase');
    if (increaseBtn) {
      increaseBtn.dataset.delta = String(fasterStep);
    }

    const tabId = activeTab?.id;
    const fallbackSpeed = storage.lastSpeed ?? 1.0;

    if (!tabId) {
      updateSpeedUI(fallbackSpeed);
      return;
    }

    const session = await getSessionStorage<{ tabSpeeds?: Record<string, number> }>({
      tabSpeeds: {},
    });
    const sessionSpeed = (session.tabSpeeds || {})[String(tabId)];
    updateSpeedUI(typeof sessionSpeed === 'number' ? sessionSpeed : fallbackSpeed);

    await refreshSpeedFromTab(tabId, fallbackSpeed);
  }

  function initializeSpeedControls(): void {
    query<HTMLElement>('#speed-decrease').addEventListener('click', function () {
      adjustSpeed(parseFloat(this.dataset.delta || '0'));
    });

    query<HTMLElement>('#speed-increase').addEventListener('click', function () {
      adjustSpeed(parseFloat(this.dataset.delta || '0'));
    });

    byId<HTMLElement>('speed-display').addEventListener('click', () => {
      setSpeed(preferredSpeed);
    });

    document.querySelectorAll<HTMLElement>('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', function () {
        setSpeed(parseFloat(this.dataset.speed || '1'));
      });
    });
  }

  function setSpeed(speed: number): void {
    void queryActiveTab()
      .then((tab) => {
        if (!tab?.id) {
          setStatusMessage('Open a supported page to control playback.', 'error');
          return;
        }

        void sendTabRuntimeMessage(tab.id, {
          type: MESSAGE_TYPES.SET_SPEED,
          payload: { speed },
        }).catch((error) => {
          reportPopupError('Could not control playback on this page.', error);
        });
        updateSpeedUI(speed);
        scheduleSpeedRefresh(tab.id, speed);
      })
      .catch((error) => {
        reportPopupError('Could not access the active tab.', error);
      });
  }

  function adjustSpeed(delta: number): void {
    void queryActiveTab()
      .then((tab) => {
        if (!tab?.id) {
          setStatusMessage('Open a supported page to control playback.', 'error');
          return;
        }

        const tabId = tab.id;
        const estimated = Math.min(16, Math.max(0.07, Number((currentSpeed + delta).toFixed(2))));
        updateSpeedUI(estimated);

        void sendTabRuntimeMessage(tabId, {
          type: MESSAGE_TYPES.ADJUST_SPEED,
          payload: { delta },
        }).catch((error) => {
          reportPopupError('Could not control playback on this page.', error);
        });
        scheduleSpeedRefresh(tabId, estimated);
        scheduleSpeedRefresh(tabId, estimated, 320);
      })
      .catch((error) => {
        reportPopupError('Could not access the active tab.', error);
      });
  }

  async function initializeSiteProfile(): Promise<void> {
    const activeTab = await queryActiveTab();
    if (!activeTab?.url) {
      return;
    }

    try {
      const rawHostname = new URL(activeTab.url).hostname;
      activeHostname = normalizeHostname(rawHostname) || rawHostname;
    } catch {
      return;
    }

    byId<HTMLElement>('site-hostname').textContent = activeHostname;
    const storage = await getSyncStorage({ siteProfiles: {} });
    setActiveSiteProfile((storage.siteProfiles || {})[activeHostname]);

    byId<HTMLButtonElement>('site-speed-toggle').addEventListener('click', () => {
      void getSyncStorage({ siteProfiles: {} })
        .then(async (storage) => {
          const profiles = storage.siteProfiles || {};
          const nextProfile = {
            ...(activeSiteProfile || profiles[activeHostname] || {}),
            speed: Number(currentSpeed.toFixed(2)),
          };

          profiles[activeHostname] = nextProfile;

          await setSyncStorage({ siteProfiles: profiles });
          setActiveSiteProfile(nextProfile);
          setStatusMessage(`Saved ${currentSpeed.toFixed(2)}x for ${activeHostname}.`, 'success');
        })
        .catch((error) => {
          reportPopupError('Could not save site profile.', error);
        });
    });

    byId<HTMLButtonElement>('site-profile-clear').addEventListener('click', () => {
      void getSyncStorage({ siteProfiles: {} })
        .then(async (storage) => {
          const profiles = storage.siteProfiles || {};

          if (profiles[activeHostname] === undefined && activeSiteProfile === undefined) {
            return;
          }

          delete profiles[activeHostname];

          await setSyncStorage({ siteProfiles: profiles });
          setActiveSiteProfile(undefined);
          setStatusMessage(`This site is back on global defaults.`, 'success');
        })
        .catch((error) => {
          reportPopupError('Could not clear site profile.', error);
        });
    });
  }
});
