import { EXTENSION_MESSAGES } from './utils/message-types.ts';

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
    const storage = await chrome.storage.sync.get({ enabled: true });
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
    await chrome.storage.sync.remove(DEPRECATED_KEYS);

    const storage = await chrome.storage.sync.get({ siteSpeedMap: null, siteProfiles: null });
    if (storage.siteSpeedMap && !storage.siteProfiles) {
      const siteProfiles: Record<string, { speed: number }> = {};
      for (const [hostname, speed] of Object.entries(
        storage.siteSpeedMap as Record<string, unknown>
      )) {
        siteProfiles[hostname] = { speed: Number(speed) };
      }
      await chrome.storage.sync.set({ siteProfiles });
      await chrome.storage.sync.remove(['siteSpeedMap']);
      console.log('[VSC] Migrated siteSpeedMap -> siteProfiles');
    } else if (storage.siteSpeedMap) {
      await chrome.storage.sync.remove(['siteSpeedMap']);
    }

    console.log('[VSC] Config migrated to current version');
  } catch (error) {
    console.error('[VSC] Config migration failed:', error);
  }
}

chrome.storage.onChanged.addListener(
  (changes: Record<string, { newValue?: unknown }>, namespace: string) => {
    if (namespace === 'sync' && changes.enabled) {
      void updateIcon(changes.enabled.newValue !== false);
    }
  }
);

chrome.runtime.onMessage.addListener((message: { type?: string; enabled?: boolean }) => {
  if (message.type === EXTENSION_MESSAGES.TOGGLE) {
    void updateIcon(message.enabled !== false);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Video Speed Controller installed/updated');
  await migrateConfig();
  await initializeIcon();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Video Speed Controller started');
  await initializeIcon();
});

void initializeIcon();

console.log('Video Speed Controller background script loaded');
