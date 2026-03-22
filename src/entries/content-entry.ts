import { injectScript, setupMessageBridge } from '../content/injection-bridge';
import { getFromChromeStorage } from '../core/chrome-storage-adapter';
import { isBlacklisted } from '../utils/blacklist';
import type { StorageSnapshot } from '../types/contracts';

async function init(): Promise<void> {
  try {
    const settings = await getFromChromeStorage();

    if (settings.enabled === false) {
      console.debug('[VSC] Extension disabled');
      return;
    }

    if (isBlacklisted(settings.blacklist || '', location.href)) {
      console.debug('[VSC] Site blacklisted');
      return;
    }

    const bootstrapSettings: StorageSnapshot = { ...(settings as StorageSnapshot) };
    delete bootstrapSettings.blacklist;
    delete bootstrapSettings.enabled;

    setupMessageBridge();

    const existingSettingsElement = document.getElementById('vsc-settings-data');
    if (existingSettingsElement) {
      existingSettingsElement.remove();
    }

    const settingsElement = document.createElement('script');
    settingsElement.id = 'vsc-settings-data';
    settingsElement.type = 'application/json';
    settingsElement.textContent = JSON.stringify(bootstrapSettings);
    (document.head || document.documentElement).appendChild(settingsElement);

    await injectScript('inject.js');

    console.debug('[VSC] Content script initialized');
  } catch (error) {
    console.error('[VSC] Failed to initialize:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
