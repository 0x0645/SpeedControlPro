import { EXTENSION_MESSAGES, MESSAGE_TYPES } from '../../utils/message-types.ts';
import { normalizeHostname } from '../../utils/hostname.ts';

let preferredSpeed = 1.0;
let currentSpeed = 1.0;
let activeHostname = '';
let activeSiteProfile: SiteProfile | undefined;
let statusTimeout: number | undefined;

type PopupStorage = {
  enabled?: boolean;
  lastSpeed?: number;
  keyBindings?: Array<{ action: string; value: number }>;
  siteProfiles?: Record<string, SiteProfile>;
};

type SiteProfile = {
  speed?: number;
  startHidden?: boolean;
  audioBoolean?: boolean;
  controllerOpacity?: number;
  controllerButtonSize?: number;
  keyBindings?: Array<{ action: string; key: number | null; value: number; force?: boolean }>;
};

type SiteInfoResponse = {
  speed?: number;
};

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

document.addEventListener('DOMContentLoaded', () => {
  loadSettingsAndInitialize();
  initializeSiteProfile();

  query<HTMLElement>('#config').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  query<HTMLElement>('#site-profile-edit').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  query<HTMLElement>('#disable').addEventListener('click', function () {
    const isCurrentlyEnabled = !this.classList.contains('disabled');
    toggleEnabled(!isCurrentlyEnabled, settingsSavedReloadMessage);
  });

  chrome.storage.sync.get({ enabled: true }, (storage: PopupStorage) => {
    toggleEnabledUI(storage.enabled !== false);
  });

  function toggleEnabled(enabled: boolean, callback?: (enabled: boolean) => void): void {
    chrome.storage.sync.set({ enabled }, () => {
      toggleEnabledUI(enabled);
      if (callback) {
        callback(enabled);
      }
    });
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

    chrome.runtime.sendMessage({ type: EXTENSION_MESSAGES.TOGGLE, enabled });
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

  function loadSettingsAndInitialize(): void {
    chrome.storage.sync.get(null, (storage: PopupStorage) => {
      let slowerStep = 0.1;
      let fasterStep = 0.1;

      if (storage.keyBindings && Array.isArray(storage.keyBindings)) {
        const slowerBinding = storage.keyBindings.find((kb: any) => kb.action === 'slower');
        const fasterBinding = storage.keyBindings.find((kb: any) => kb.action === 'faster');
        const fastBinding = storage.keyBindings.find((kb: any) => kb.action === 'fast');

        if (slowerBinding && typeof slowerBinding.value === 'number') {
          slowerStep = slowerBinding.value;
        }
        if (fasterBinding && typeof fasterBinding.value === 'number') {
          fasterStep = fasterBinding.value;
        }
        if (fastBinding && typeof fastBinding.value === 'number') {
          preferredSpeed = fastBinding.value;
        }
      }

      const decreaseBtn = query<HTMLElement>('#speed-decrease');
      if (decreaseBtn) {
        decreaseBtn.dataset.delta = String(-slowerStep);
      }
      const increaseBtn = query<HTMLElement>('#speed-increase');
      if (increaseBtn) {
        increaseBtn.dataset.delta = String(fasterStep);
      }

      initializeSpeedControls();

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id!,
            { type: MESSAGE_TYPES.GET_SITE_INFO },
            (response: SiteInfoResponse) => {
              const speed = (response && response.speed) || storage.lastSpeed || 1.0;
              updateSpeedUI(speed);
            }
          );
        } else {
          updateSpeedUI(storage.lastSpeed || 1.0);
        }
      });
    });
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id!, {
          type: MESSAGE_TYPES.SET_SPEED,
          payload: { speed },
        });
        updateSpeedUI(speed);
      }
    });
  }

  function adjustSpeed(delta: number): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id!, {
          type: MESSAGE_TYPES.ADJUST_SPEED,
          payload: { delta },
        });
        globalThis.setTimeout(() => {
          chrome.tabs.sendMessage(
            tabs[0].id!,
            { type: MESSAGE_TYPES.GET_SITE_INFO },
            (response: SiteInfoResponse) => {
              if (response && response.speed) {
                updateSpeedUI(response.speed);
              }
            }
          );
        }, 100);
      }
    });
  }

  function initializeSiteProfile(): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (!tabs[0] || !tabs[0].url) {
        return;
      }

      try {
        const rawHostname = new URL(tabs[0].url).hostname;
        activeHostname = normalizeHostname(rawHostname) || rawHostname;
      } catch {
        return;
      }

      byId<HTMLElement>('site-hostname').textContent = activeHostname;
      chrome.storage.sync.get({ siteProfiles: {} }, (storage: PopupStorage) => {
        setActiveSiteProfile((storage.siteProfiles || {})[activeHostname]);
      });

      byId<HTMLButtonElement>('site-speed-toggle').addEventListener('click', () => {
        chrome.storage.sync.get({ siteProfiles: {} }, (storage: PopupStorage) => {
          const profiles = storage.siteProfiles || {};
          const nextProfile = {
            ...(activeSiteProfile || profiles[activeHostname] || {}),
            speed: Number(currentSpeed.toFixed(2)),
          };

          profiles[activeHostname] = nextProfile;

          chrome.storage.sync.set({ siteProfiles: profiles }, () => {
            setActiveSiteProfile(nextProfile);
            setStatusMessage(`Saved ${currentSpeed.toFixed(2)}x for ${activeHostname}.`, 'success');
          });
        });
      });

      byId<HTMLButtonElement>('site-profile-clear').addEventListener('click', () => {
        chrome.storage.sync.get({ siteProfiles: {} }, (storage: PopupStorage) => {
          const profiles = storage.siteProfiles || {};

          if (profiles[activeHostname] === undefined && activeSiteProfile === undefined) {
            return;
          }

          delete profiles[activeHostname];

          chrome.storage.sync.set({ siteProfiles: profiles }, () => {
            setActiveSiteProfile(undefined);
            setStatusMessage(`This site is back on global defaults.`, 'success');
          });
        });
      });
    });
  }
});
