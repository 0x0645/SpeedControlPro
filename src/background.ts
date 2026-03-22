import { EXTENSION_MESSAGES } from './utils/message-types';
import {
  getFromChromeSessionStorage,
  setInChromeSessionStorage,
} from './core/chrome-session-adapter';
import {
  getFromChromeStorage,
  removeFromChromeStorage,
  setInChromeStorage,
} from './core/chrome-storage-adapter';
import type { ExtensionToggleMessage, StorageChangeMap } from './types/contracts';
import type { SiteProfile } from './types/settings';

type BackgroundMessage =
  | ExtensionToggleMessage
  | {
      type: 'VSC_TAB_SPEED_UPDATE';
      lastSpeed?: number;
    };

type SessionSpeedStorage = {
  tabSpeeds?: Record<string, number>;
};

type LegacyMigrationStorage = {
  siteSpeedMap?: unknown;
  siteProfiles?: Record<string, SiteProfile> | null;
};

type LegacySiteSpeedMap = Record<string, number | string>;

function hasSiteSpeedMap(value: unknown): value is LegacySiteSpeedMap {
  return typeof value === 'object' && value !== null;
}

function migrateSiteSpeedMap(siteSpeedMap: LegacySiteSpeedMap): Record<string, SiteProfile> {
  const siteProfiles: Record<string, SiteProfile> = {};

  for (const [hostname, speed] of Object.entries(siteSpeedMap)) {
    siteProfiles[hostname] = { speed: Number(speed) };
  }

  return siteProfiles;
}

async function getSessionTabSpeeds(): Promise<Record<string, number>> {
  const session = await getFromChromeSessionStorage<SessionSpeedStorage>({ tabSpeeds: {} });
  return session.tabSpeeds || {};
}

async function setSessionTabSpeeds(tabSpeeds: Record<string, number>): Promise<void> {
  await setInChromeSessionStorage({ tabSpeeds });
}

async function updateTabSpeed(tabId: number, speed: number): Promise<void> {
  const tabSpeeds = await getSessionTabSpeeds();
  await setSessionTabSpeeds({
    ...tabSpeeds,
    [String(tabId)]: speed,
  });
}

async function removeTabSpeed(tabId: number): Promise<void> {
  const tabSpeeds = await getSessionTabSpeeds();
  delete tabSpeeds[String(tabId)];
  await setSessionTabSpeeds(tabSpeeds);
}

export async function updateIcon(enabled: boolean): Promise<void> {
  try {
    const suffix = enabled ? '' : '_disabled';
    await chrome.action.setIcon({
      path: {
        19: `assets/icons/icon19${suffix}.png`,
        38: `assets/icons/icon38${suffix}.png`,
        48: `assets/icons/icon48${suffix}.png`,
      },
    });
    console.log(`Icon updated: ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Failed to update icon:', error);
  }
}

export async function initializeIcon(): Promise<void> {
  try {
    const storage = await getFromChromeStorage({ enabled: true });
    await updateIcon(storage.enabled !== false);
  } catch (error) {
    console.error('Failed to initialize icon:', error);
    await updateIcon(true);
  }
}

export async function migrateConfig(): Promise<void> {
  const DEPRECATED_KEYS = [
    'speeds',
    'version',
    'resetSpeed',
    'speedStep',
    'fastSpeed',
    'rewindTime',
    'advanceTime',
    'resetKeyCode',
    'slowerKeyCode',
    'fasterKeyCode',
    'rewindKeyCode',
    'advanceKeyCode',
    'fastKeyCode',
    'displayKeyCode',
  ];

  try {
    await removeFromChromeStorage(DEPRECATED_KEYS);

    const storage = (await getFromChromeStorage()) as LegacyMigrationStorage;
    if (hasSiteSpeedMap(storage.siteSpeedMap) && !storage.siteProfiles) {
      const siteProfiles = migrateSiteSpeedMap(storage.siteSpeedMap);
      await setInChromeStorage({ siteProfiles });
      await removeFromChromeStorage(['siteSpeedMap']);
      console.log('[VSC] Migrated siteSpeedMap -> siteProfiles');
    } else if (hasSiteSpeedMap(storage.siteSpeedMap)) {
      await removeFromChromeStorage(['siteSpeedMap']);
    }

    console.log('[VSC] Config migrated to current version');
  } catch (error) {
    console.error('[VSC] Config migration failed:', error);
  }
}

chrome.storage.onChanged.addListener((changes: StorageChangeMap, namespace: string) => {
  if (namespace === 'sync' && changes.enabled) {
    void updateIcon(changes.enabled.newValue !== false);
  }
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender: { tab?: { id?: number } }) => {
    if (message.type === EXTENSION_MESSAGES.TOGGLE) {
      void updateIcon(message.enabled !== false);
      return;
    }

    if (message.type === EXTENSION_MESSAGES.TAB_SPEED_UPDATE && sender.tab?.id !== undefined) {
      const tabId = sender.tab.id;
      const lastSpeed = message.lastSpeed;
      if (typeof lastSpeed === 'number' && Number.isFinite(lastSpeed)) {
        void updateTabSpeed(tabId, lastSpeed);
      }
    }
  }
);

chrome.tabs.onRemoved.addListener((tabId: number) => {
  void removeTabSpeed(tabId);
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Video Speed Controller installed/updated');
  await migrateConfig();
  await initializeIcon();
  // Clean up legacy tabSpeeds from sync storage
  await removeFromChromeStorage(['tabSpeeds']);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Video Speed Controller started');
  await initializeIcon();
});

void initializeIcon();

console.log('Video Speed Controller background script loaded');
