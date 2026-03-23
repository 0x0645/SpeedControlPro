/**
 * Options page - depends on core VSC modules
 */
import { DEFAULT_SETTINGS, CUSTOM_ACTIONS_NO_VALUES, regStrip } from '../../utils/constants';
import { VideoSpeedConfig, videoSpeedConfig } from '../../core/settings';
import { StorageManager } from '../../core/storage-manager';
import type { KeyBinding } from '../../types/settings';
import { BLACKLISTED_KEYCODES, normalizeKeyBindingsForce } from './options-key-utils';
import { renderSiteProfileList } from './options-site-profiles';
import { normalizeHostname } from '../../utils/hostname';
import {
  addShortcut,
  createShortcutBinding,
  inputBlur,
  inputFilterNumbersOnly,
  inputFocus,
  recordKeyPress,
  showExperimental,
  updateCustomShortcutInputText,
} from './options-shortcuts';

let config = videoSpeedConfig;

type ShortcutBinding = Omit<KeyBinding, 'key'> & { key: number | null };

function getElement<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

let keyBindings: ShortcutBinding[] = [];

// Validates settings before saving
function validate(): boolean {
  let valid = true;
  const status = getElement<HTMLElement>('status');
  const blacklist = getElement<HTMLTextAreaElement>('blacklist');

  // Clear any existing timeout for validation errors
  if (window.validationTimeout) {
    clearTimeout(window.validationTimeout);
  }

  blacklist.value.split('\n').forEach((match) => {
    match = match.replace(regStrip, '');

    if (match.startsWith('/')) {
      try {
        const parts = match.split('/');

        if (parts.length < 3) {
          throw new Error('invalid regex');
        }

        const flags = parts.pop();
        const regex = parts.slice(1).join('/');

        new RegExp(regex, flags);
      } catch {
        status.textContent = `Error: Invalid blacklist regex: "${match}". Unable to save. Try wrapping it in foward slashes.`;
        status.classList.add('show', 'error');
        valid = false;

        // Auto-hide validation error after 5 seconds
        window.validationTimeout = setTimeout(() => {
          status.textContent = '';
          status.classList.remove('show', 'error');
        }, 5000);
      }
    }
  });
  return valid;
}

function showStatusMessage(message: string, tone = 'success', timeout = 2500): void {
  const status = getElement<HTMLElement>('status');
  status.textContent = message;
  status.classList.remove('success', 'error');
  status.classList.add('show');

  if (tone) {
    status.classList.add(tone);
  }

  setTimeout(() => {
    status.textContent = '';
    status.classList.remove('show', 'success', 'error');
  }, timeout);
}

// Saves options using VideoSpeedConfig system
async function save_options() {
  if (validate() === false) {
    return;
  }

  const status = getElement<HTMLElement>('status');
  status.textContent = 'Saving...';
  status.classList.remove('success', 'error');
  status.classList.add('show');

  try {
    keyBindings = [];
    Array.from(document.querySelectorAll<HTMLElement>('.customs')).forEach((item) =>
      keyBindings.push(createShortcutBinding(item))
    );

    keyBindings = normalizeKeyBindingsForce(
      keyBindings as unknown as KeyBinding[]
    ) as ShortcutBinding[];

    const rememberSpeed = getElement<HTMLInputElement>('rememberSpeed').checked;
    const forceLastSavedSpeed = getElement<HTMLInputElement>('forceLastSavedSpeed').checked;
    const audioBoolean = getElement<HTMLInputElement>('audioBoolean').checked;
    const startHidden = getElement<HTMLInputElement>('startHidden').checked;
    const controllerOpacity = Number(getElement<HTMLInputElement>('controllerOpacity').value);
    const controllerButtonSize = Number(getElement<HTMLInputElement>('controllerButtonSize').value);
    const logLevel = parseInt(getElement<HTMLSelectElement>('logLevel').value, 10);
    const blacklist = getElement<HTMLTextAreaElement>('blacklist').value;

    // Ensure VideoSpeedConfig singleton is initialized
    if (!config) {
      config = new VideoSpeedConfig();
    }

    // Use VideoSpeedConfig to save settings
    const settingsToSave = {
      rememberSpeed: rememberSpeed,
      forceLastSavedSpeed: forceLastSavedSpeed,
      audioBoolean: audioBoolean,
      startHidden: startHidden,
      controllerOpacity: controllerOpacity,
      controllerButtonSize: controllerButtonSize,
      logLevel: logLevel,
      keyBindings: keyBindings as unknown as KeyBinding[],
      blacklist: blacklist.replace(regStrip, ''),
    };

    // Save with optimistic UI (like old version)
    await config.save(settingsToSave);

    status.textContent = 'Options saved';
    status.classList.add('success');
    setTimeout(() => {
      status.textContent = '';
      status.classList.remove('show', 'success');
    }, 2000);
  } catch (error) {
    // Only show error for actual storage failures
    console.error('Failed to save options:', error);
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Error saving options: ${message}`;
    status.classList.add('show', 'error');
    setTimeout(() => {
      status.textContent = '';
      status.classList.remove('show', 'error');
    }, 3000);
  }
}

// Restores options using VideoSpeedConfig system
async function restore_options() {
  try {
    // Ensure VideoSpeedConfig singleton is initialized
    if (!config) {
      config = new VideoSpeedConfig();
    }

    // Load settings using VideoSpeedConfig
    await config.load();
    const storage = config.settings;

    getElement<HTMLInputElement>('rememberSpeed').checked = storage.rememberSpeed;
    getElement<HTMLInputElement>('forceLastSavedSpeed').checked = storage.forceLastSavedSpeed;
    getElement<HTMLInputElement>('audioBoolean').checked = storage.audioBoolean;
    getElement<HTMLInputElement>('startHidden').checked = storage.startHidden;
    getElement<HTMLInputElement>('controllerOpacity').value = String(storage.controllerOpacity);
    getElement<HTMLInputElement>('controllerButtonSize').value = String(
      storage.controllerButtonSize
    );
    getElement<HTMLSelectElement>('logLevel').value = String(storage.logLevel);
    getElement<HTMLTextAreaElement>('blacklist').value = storage.blacklist;

    // Process key bindings
    const keyBindings = storage.keyBindings || DEFAULT_SETTINGS.keyBindings;

    for (const item of keyBindings) {
      if (item.predefined) {
        // Handle predefined shortcuts
        if (item.action === 'display' && typeof item.key === 'undefined') {
          item.key = 86; // V
        }

        if (CUSTOM_ACTIONS_NO_VALUES.includes(item.action)) {
          const valueInput = document.querySelector<HTMLInputElement>(
            `#${item.action} .customValue`
          );
          if (valueInput) {
            valueInput.style.display = 'none';
          }
        }

        const keyInput = document.querySelector<HTMLInputElement & { keyCode?: number | null }>(
          `#${item.action} .customKey`
        );
        const valueInput = document.querySelector<HTMLInputElement>(`#${item.action} .customValue`);
        const forceInput = document.querySelector<HTMLSelectElement>(
          `#${item.action} .customForce`
        );

        if (keyInput) {
          updateCustomShortcutInputText(keyInput, item.key);
        }
        if (valueInput) {
          valueInput.value = String(item.value);
        }
        if (forceInput) {
          forceInput.value = String(item.force);
        }
      } else {
        // Handle custom shortcuts
        addShortcut();
        const dom = document.querySelector('.customs:last-of-type') as HTMLElement;
        (dom.querySelector('.customDo') as HTMLSelectElement).value = item.action;

        if (CUSTOM_ACTIONS_NO_VALUES.includes(item.action)) {
          const valueInput = dom.querySelector<HTMLInputElement>('.customValue');
          if (valueInput) {
            valueInput.style.display = 'none';
          }
        }

        updateCustomShortcutInputText(
          dom.querySelector('.customKey') as HTMLInputElement & { keyCode?: number | null },
          item.key
        );
        (dom.querySelector('.customValue') as HTMLInputElement).value = String(item.value);
        // If force value exists in settings but element doesn't exist, create it
        if (item.force !== undefined && !dom.querySelector('.customForce')) {
          const customValue = dom.querySelector('.customValue') as HTMLInputElement;
          const select = document.createElement('select');
          select.className = 'customForce'; // Don't add 'show' class initially
          select.innerHTML = `
            <option value="false">Default behavior</option>
            <option value="true">Override site keys</option>
          `;
          select.value = String(item.force);
          customValue.parentNode?.insertBefore(select, customValue.nextSibling);
        } else {
          const forceSelect = dom.querySelector<HTMLSelectElement>('.customForce');
          if (forceSelect) {
            forceSelect.value = String(item.force);
          }
        }
      }
    }

    // Check if any keybindings have force property set, if so, show experimental features
    const hasExperimentalFeatures = keyBindings.some(
      (kb) => kb.force !== undefined && kb.force !== false
    );
    if (hasExperimentalFeatures) {
      showExperimental(config);
    }
  } catch (error) {
    console.error('Failed to restore options:', error);
    const message = error instanceof Error ? error.message : String(error);
    getElement<HTMLElement>('status').textContent = `Error loading options: ${message}`;
    getElement<HTMLElement>('status').classList.add('show', 'error');
    setTimeout(() => {
      getElement<HTMLElement>('status').textContent = '';
      getElement<HTMLElement>('status').classList.remove('show', 'error');
    }, 3000);
  }
}

async function restore_defaults() {
  const status = getElement<HTMLElement>('status');

  try {
    status.textContent = 'Restoring defaults...';
    status.classList.remove('success', 'error');
    status.classList.add('show');

    // Clear all storage
    await StorageManager.clear();

    // Ensure VideoSpeedConfig singleton is initialized
    if (!config) {
      config = new VideoSpeedConfig();
    }

    // Then save fresh defaults
    await config.save(DEFAULT_SETTINGS);

    // Remove custom shortcuts from UI
    document
      .querySelectorAll<HTMLButtonElement>('.removeParent')
      .forEach((button) => button.click());

    // Reload the options page
    await restore_options();

    // Re-render per-site speeds (now empty)
    await refreshSiteProfileList();

    status.textContent = 'Default options restored';
    status.classList.add('success');
    setTimeout(() => {
      status.textContent = '';
      status.classList.remove('show', 'success');
    }, 2000);
  } catch (error) {
    console.error('Failed to restore defaults:', error);
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Error restoring defaults: ${message}`;
    status.classList.add('show', 'error');
    setTimeout(() => {
      status.textContent = '';
      status.classList.remove('show', 'error');
    }, 3000);
  }
}

// Per-site profile management

async function refreshSiteProfileList() {
  await renderSiteProfileList({
    config,
    ensureConfig,
    noValueActions: CUSTOM_ACTIONS_NO_VALUES,
    blacklistedKeyCodes: [...BLACKLISTED_KEYCODES],
  });
}

async function ensureConfig() {
  if (!config) {
    config = new VideoSpeedConfig();
    await config.load();
  }
}

async function addSiteProfile() {
  const hostnameInput = getElement<HTMLInputElement>('site-profile-hostname');
  const rawHostname = hostnameInput.value.trim();

  if (!rawHostname) {
    return;
  }

  const hostname = normalizeHostname(rawHostname);

  if (!hostname) {
    showStatusMessage('Enter a valid hostname like youtube.com (without www).', 'error', 3000);
    return;
  }

  await ensureConfig();
  // Create an empty profile shell so every setting continues inheriting global defaults
  if (!config.settings.siteProfiles) {
    config.settings.siteProfiles = {};
  }

  if (config.settings.siteProfiles[hostname]) {
    showStatusMessage(`A profile for ${hostname} already exists.`, 'error', 3000);
    hostnameInput.value = '';
    return;
  }

  config.settings.siteProfiles[hostname] = {};
  await config.save({
    siteProfiles: config.settings.siteProfiles,
  });

  hostnameInput.value = '';
  await refreshSiteProfileList();
  showStatusMessage(`Created a website profile for ${hostname}.`);
}

// Create debounced save function to prevent rapid saves
document.addEventListener('DOMContentLoaded', async () => {
  await restore_options();

  // Disable action dropdowns for predefined shortcuts
  document.querySelectorAll<HTMLSelectElement>('.row.customs[id] .customDo').forEach((select) => {
    select.disabled = true;
  });

  getElement<HTMLButtonElement>('save').addEventListener('click', async (e) => {
    e.preventDefault();
    await save_options();
  });

  getElement<HTMLButtonElement>('add').addEventListener('click', addShortcut);

  getElement<HTMLButtonElement>('restore').addEventListener('click', async (e) => {
    e.preventDefault();
    await restore_defaults();
  });

  getElement<HTMLButtonElement>('experimental').addEventListener('click', () => {
    showExperimental(config);
  });

  // Per-site speed management
  await refreshSiteProfileList();
  getElement<HTMLButtonElement>('site-profile-add-btn').addEventListener('click', addSiteProfile);
  getElement<HTMLInputElement>('site-profile-hostname').addEventListener(
    'keydown',
    async (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await addSiteProfile();
      }
    }
  );

  // About and feedback button event listeners
  getElement('about').addEventListener('click', () => {
    window.open('https://github.com/0x0645/SpeedControlPro');
  });

  getElement('feedback').addEventListener('click', () => {
    window.open('https://github.com/0x0645/SpeedControlPro/issues');
  });

  function eventCaller(event: Event, className: string, funcName: (event: Event) => void): void {
    if (!(event.target instanceof HTMLElement) || !event.target.classList.contains(className)) {
      return;
    }
    funcName(event);
  }

  document.addEventListener('keypress', (event) => {
    eventCaller(event, 'customValue', (innerEvent) =>
      inputFilterNumbersOnly(innerEvent as KeyboardEvent)
    );
  });
  document.addEventListener('focus', (event) => {
    eventCaller(event, 'customKey', (innerEvent) => inputFocus(innerEvent as FocusEvent));
  });
  document.addEventListener('blur', (event) => {
    eventCaller(event, 'customKey', (innerEvent) => inputBlur(innerEvent as FocusEvent));
  });
  document.addEventListener('keydown', (event) => {
    eventCaller(event, 'customKey', (innerEvent) => recordKeyPress(innerEvent as KeyboardEvent));
  });
  document.addEventListener('click', (event) => {
    eventCaller(event, 'removeParent', () => {
      (event.target as HTMLElement).parentNode?.removeChild(event.target as HTMLElement);
    });
  });
  document.addEventListener('change', (event) => {
    eventCaller(event, 'customDo', () => {
      const target = event.target as HTMLSelectElement;
      const valueInput = target.nextElementSibling?.nextElementSibling as HTMLInputElement;
      if (CUSTOM_ACTIONS_NO_VALUES.includes(target.value)) {
        valueInput.style.display = 'none';
        valueInput.value = '0';
      } else {
        valueInput.style.display = 'inline-block';
      }
    });
  });
});
