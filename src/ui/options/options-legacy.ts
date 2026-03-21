// @ts-nocheck
/**
 * Options page - depends on core VSC modules
 */
import { DEFAULT_SETTINGS, CUSTOM_ACTIONS_NO_VALUES, regStrip } from '../../utils/constants';
import { VideoSpeedConfig, videoSpeedConfig } from '../../core/settings';
import { StorageManager } from '../../core/storage-manager';
import {
  ACTION_OPTIONS,
  BLACKLISTED_KEYCODES as IMPORTED_BLACKLISTED_KEYCODES,
  keyCodeToLabel,
  KEY_CODE_ALIASES,
  normalizeKeyBindingsForce,
} from './options-key-utils';
import { buildProfileKeybindingRow, cloneGlobalBindings } from './options-profile-utils';
import { normalizeHostname } from '../../utils/hostname';

let config = videoSpeedConfig;

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

var keyBindings = [];

// Minimal blacklist - only keys that would interfere with form navigation
const BLACKLISTED_KEYCODES = [
  9, // Tab - needed for keyboard navigation
  16, // Shift (alone)
  17, // Ctrl/Control (alone)
  18, // Alt (alone)
  91, // Meta/Windows/Command Left
  92, // Meta/Windows Right
  93, // Context Menu/Right Command
  224, // Meta/Command (Firefox)
];

var keyCodeAliases = {
  0: 'null',
  null: 'null',
  undefined: 'null',
  32: 'Space',
  37: 'Left',
  38: 'Up',
  39: 'Right',
  40: 'Down',
  96: 'Num 0',
  97: 'Num 1',
  98: 'Num 2',
  99: 'Num 3',
  100: 'Num 4',
  101: 'Num 5',
  102: 'Num 6',
  103: 'Num 7',
  104: 'Num 8',
  105: 'Num 9',
  106: 'Num *',
  107: 'Num +',
  109: 'Num -',
  110: 'Num .',
  111: 'Num /',
  112: 'F1',
  113: 'F2',
  114: 'F3',
  115: 'F4',
  116: 'F5',
  117: 'F6',
  118: 'F7',
  119: 'F8',
  120: 'F9',
  121: 'F10',
  122: 'F11',
  123: 'F12',
  124: 'F13',
  125: 'F14',
  126: 'F15',
  127: 'F16',
  128: 'F17',
  129: 'F18',
  130: 'F19',
  131: 'F20',
  132: 'F21',
  133: 'F22',
  134: 'F23',
  135: 'F24',
  186: ';',
  188: '<',
  189: '-',
  187: '+',
  190: '>',
  191: '/',
  192: '~',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
};

keyCodeAliases = KEY_CODE_ALIASES;

function recordKeyPress(e) {
  // Special handling for backspace and escape
  if (e.keyCode === 8) {
    // Clear input when backspace pressed
    e.target.value = '';
    e.preventDefault();
    e.stopPropagation();
    return;
  } else if (e.keyCode === 27) {
    // When esc clicked, clear input
    e.target.value = 'null';
    e.target.keyCode = null;
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // Block blacklisted keys
  if (BLACKLISTED_KEYCODES.includes(e.keyCode)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // Accept all other keys
  // Use friendly name if available, otherwise show "Key {code}"
  e.target.value = keyCodeToLabel(e.keyCode);
  e.target.keyCode = e.keyCode;

  e.preventDefault();
  e.stopPropagation();
}

function inputFilterNumbersOnly(e) {
  var char = String.fromCharCode(e.keyCode);
  if (!/[\d\.]$/.test(char) || !/^\d+(\.\d*)?$/.test(e.target.value + char)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function inputFocus(e) {
  e.target.value = '';
}

function inputBlur(e) {
  const keyCode = e.target.keyCode;
  e.target.value = keyCodeToLabel(keyCode);
}

function updateShortcutInputText(inputId, keyCode) {
  const input = document.getElementById(inputId);
  input.value = keyCodeToLabel(keyCode);
  input.keyCode = keyCode;
}

function updateCustomShortcutInputText(inputItem, keyCode) {
  inputItem.value = keyCodeToLabel(keyCode);
  inputItem.keyCode = keyCode;
}

function add_shortcut() {
  var html = `<select class="customDo">
    <option value="slower">Decrease speed</option>
    <option value="faster">Increase speed</option>
    <option value="rewind">Rewind</option>
    <option value="advance">Advance</option>
    <option value="reset">Reset speed</option>
    <option value="fast">Preferred speed</option>
    <option value="muted">Mute</option>
    <option value="softer">Decrease volume</option>
    <option value="louder">Increase volume</option>
    <option value="pause">Pause</option>
    <option value="mark">Set marker</option>
    <option value="jump">Jump to marker</option>
    <option value="display">Show/hide controller</option>
    </select>
    <input class="customKey" type="text" placeholder="press a key"/>
    <input class="customValue" type="text" placeholder="value (0.10)"/>
    <button class="removeParent">&times;</button>`;
  var div = document.createElement('div');
  div.setAttribute('class', 'row customs');
  div.innerHTML = html;
  var customs_element = document.getElementById('customs');
  var addBtn = document.getElementById('add');
  customs_element.insertBefore(div, addBtn);

  // If experimental features are already enabled, add the force select
  const experimentalButton = document.getElementById('experimental');
  if (experimentalButton && experimentalButton.disabled) {
    const customValue = div.querySelector('.customValue');
    const select = document.createElement('select');
    select.className = 'customForce show';
    select.innerHTML = `
      <option value="false">Default behavior</option>
      <option value="true">Override site keys</option>
    `;
    customValue.parentNode.insertBefore(select, customValue.nextSibling);
  }
}

function createKeyBindings(item) {
  const action = item.querySelector('.customDo').value;
  const key = item.querySelector('.customKey').keyCode;
  const value = Number(item.querySelector('.customValue').value);
  const forceElement = item.querySelector('.customForce');
  const force = forceElement ? forceElement.value : 'false';
  const predefined = !!item.id; //item.id ? true : false;

  keyBindings.push({
    action: action,
    key: key,
    value: value,
    force: force,
    predefined: predefined,
  });
}

// Validates settings before saving
function validate() {
  var valid = true;
  var status = document.getElementById('status');
  var blacklist = document.getElementById('blacklist');

  // Clear any existing timeout for validation errors
  if (window.validationTimeout) {
    clearTimeout(window.validationTimeout);
  }

  blacklist.value.split('\n').forEach((match) => {
    match = match.replace(regStrip, '');

    if (match.startsWith('/')) {
      try {
        var parts = match.split('/');

        if (parts.length < 3) throw 'invalid regex';

        var flags = parts.pop();
        var regex = parts.slice(1).join('/');

        var regexp = new RegExp(regex, flags);
      } catch (err) {
        status.textContent =
          'Error: Invalid blacklist regex: "' +
          match +
          '". Unable to save. Try wrapping it in foward slashes.';
        status.classList.add('show', 'error');
        valid = false;

        // Auto-hide validation error after 5 seconds
        window.validationTimeout = setTimeout(function () {
          status.textContent = '';
          status.classList.remove('show', 'error');
        }, 5000);

        return;
      }
    }
  });
  return valid;
}

function showStatusMessage(message, tone = 'success', timeout = 2500) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.remove('success', 'error');
  status.classList.add('show');

  if (tone) {
    status.classList.add(tone);
  }

  setTimeout(function () {
    status.textContent = '';
    status.classList.remove('show', 'success', 'error');
  }, timeout);
}

// Saves options using VideoSpeedConfig system
async function save_options() {
  if (validate() === false) {
    return;
  }

  var status = document.getElementById('status');
  status.textContent = 'Saving...';
  status.classList.remove('success', 'error');
  status.classList.add('show');

  try {
    keyBindings = [];
    Array.from(document.querySelectorAll('.customs')).forEach((item) => createKeyBindings(item));

    keyBindings = normalizeKeyBindingsForce(keyBindings);

    var rememberSpeed = document.getElementById('rememberSpeed').checked;
    var forceLastSavedSpeed = document.getElementById('forceLastSavedSpeed').checked;
    var audioBoolean = document.getElementById('audioBoolean').checked;
    var startHidden = document.getElementById('startHidden').checked;
    var controllerOpacity = Number(document.getElementById('controllerOpacity').value);
    var controllerButtonSize = Number(document.getElementById('controllerButtonSize').value);
    var logLevel = parseInt(document.getElementById('logLevel').value);
    var blacklist = document.getElementById('blacklist').value;

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
      keyBindings: keyBindings,
      blacklist: blacklist.replace(regStrip, ''),
    };

    // Save with optimistic UI (like old version)
    await config.save(settingsToSave);

    status.textContent = 'Options saved';
    status.classList.add('success');
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('show', 'success');
    }, 2000);
  } catch (error) {
    // Only show error for actual storage failures
    console.error('Failed to save options:', error);
    status.textContent = 'Error saving options: ' + error.message;
    status.classList.add('show', 'error');
    setTimeout(function () {
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

    document.getElementById('rememberSpeed').checked = storage.rememberSpeed;
    document.getElementById('forceLastSavedSpeed').checked = storage.forceLastSavedSpeed;
    document.getElementById('audioBoolean').checked = storage.audioBoolean;
    document.getElementById('startHidden').checked = storage.startHidden;
    document.getElementById('controllerOpacity').value = storage.controllerOpacity;
    document.getElementById('controllerButtonSize').value = storage.controllerButtonSize;
    document.getElementById('logLevel').value = storage.logLevel;
    document.getElementById('blacklist').value = storage.blacklist;

    // Process key bindings
    const keyBindings = storage.keyBindings || DEFAULT_SETTINGS.keyBindings;

    for (let i in keyBindings) {
      var item = keyBindings[i];

      if (item.predefined) {
        // Handle predefined shortcuts
        if (item['action'] == 'display' && typeof item['key'] === 'undefined') {
          item['key'] = 86; // V
        }

        if (CUSTOM_ACTIONS_NO_VALUES.includes(item['action'])) {
          const valueInput = document.querySelector('#' + item['action'] + ' .customValue');
          if (valueInput) {
            valueInput.style.display = 'none';
          }
        }

        const keyInput = document.querySelector('#' + item['action'] + ' .customKey');
        const valueInput = document.querySelector('#' + item['action'] + ' .customValue');
        const forceInput = document.querySelector('#' + item['action'] + ' .customForce');

        if (keyInput) {
          updateCustomShortcutInputText(keyInput, item['key']);
        }
        if (valueInput) {
          valueInput.value = item['value'];
        }
        if (forceInput) {
          forceInput.value = String(item['force']);
        }
      } else {
        // Handle custom shortcuts
        add_shortcut();
        const dom = document.querySelector('.customs:last-of-type');
        dom.querySelector('.customDo').value = item['action'];

        if (CUSTOM_ACTIONS_NO_VALUES.includes(item['action'])) {
          const valueInput = dom.querySelector('.customValue');
          if (valueInput) {
            valueInput.style.display = 'none';
          }
        }

        updateCustomShortcutInputText(dom.querySelector('.customKey'), item['key']);
        dom.querySelector('.customValue').value = item['value'];
        // If force value exists in settings but element doesn't exist, create it
        if (item['force'] !== undefined && !dom.querySelector('.customForce')) {
          const customValue = dom.querySelector('.customValue');
          const select = document.createElement('select');
          select.className = 'customForce'; // Don't add 'show' class initially
          select.innerHTML = `
            <option value="false">Default behavior</option>
            <option value="true">Override site keys</option>
          `;
          select.value = String(item['force']);
          customValue.parentNode.insertBefore(select, customValue.nextSibling);
        } else {
          const forceSelect = dom.querySelector('.customForce');
          if (forceSelect) {
            forceSelect.value = String(item['force']);
          }
        }
      }
    }

    // Check if any keybindings have force property set, if so, show experimental features
    const hasExperimentalFeatures = keyBindings.some(
      (kb) => kb.force !== undefined && kb.force !== false
    );
    if (hasExperimentalFeatures) {
      show_experimental();
    }
  } catch (error) {
    console.error('Failed to restore options:', error);
    document.getElementById('status').textContent = 'Error loading options: ' + error.message;
    document.getElementById('status').classList.add('show', 'error');
    setTimeout(function () {
      document.getElementById('status').textContent = '';
      document.getElementById('status').classList.remove('show', 'error');
    }, 3000);
  }
}

async function restore_defaults() {
  try {
    var status = document.getElementById('status');
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
    document.querySelectorAll('.removeParent').forEach((button) => button.click());

    // Reload the options page
    await restore_options();

    // Re-render per-site speeds (now empty)
    renderSiteProfileList();

    status.textContent = 'Default options restored';
    status.classList.add('success');
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('show', 'success');
    }, 2000);
  } catch (error) {
    console.error('Failed to restore defaults:', error);
    status.textContent = 'Error restoring defaults: ' + error.message;
    status.classList.add('show', 'error');
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('show', 'error');
    }, 3000);
  }
}

function show_experimental() {
  const button = document.getElementById('experimental');
  const customRows = document.querySelectorAll('.row.customs');
  const advancedRows = document.querySelectorAll('.row.advanced-feature');

  // Show advanced feature rows
  advancedRows.forEach((row) => {
    row.classList.add('show');
  });

  // Create the select template
  const createForceSelect = () => {
    const select = document.createElement('select');
    select.className = 'customForce show';
    select.innerHTML = `
      <option value="false">Allow event propagation</option>
      <option value="true">Disable event propagation</option>
    `;
    return select;
  };

  // Add select to each row
  customRows.forEach((row) => {
    const existingSelect = row.querySelector('.customForce');

    if (!existingSelect) {
      // Create new select if it doesn't exist
      const customValue = row.querySelector('.customValue');
      const newSelect = createForceSelect();

      // Check if this row has saved force value
      const rowId = row.id;
      if (
        rowId &&
        config &&
        config.settings.keyBindings
      ) {
        // For predefined shortcuts
        const savedBinding = config.settings.keyBindings.find(
          (kb) => kb.action === rowId
        );
        if (savedBinding && savedBinding.force !== undefined) {
          newSelect.value = String(savedBinding.force);
        }
      } else if (!rowId) {
        // For custom shortcuts, try to find the force value from the current keyBindings array
        const rowIndex = Array.from(
          row.parentElement.querySelectorAll('.row.customs:not([id])')
        ).indexOf(row);
        const customBindings =
          config?.settings.keyBindings?.filter((kb) => !kb.predefined) || [];
        if (customBindings[rowIndex] && customBindings[rowIndex].force !== undefined) {
          newSelect.value = String(customBindings[rowIndex].force);
        }
      }

      // Insert after the customValue input
      if (customValue) {
        customValue.parentNode.insertBefore(newSelect, customValue.nextSibling);
      }
    } else {
      // If it already exists, just show it
      existingSelect.classList.add('show');
    }
  });

  // Update button text to indicate the feature is now enabled
  button.textContent = 'Advanced features enabled';
  button.disabled = true;
}

// Per-site profile management

function getProfileOverrideCount(profile) {
  let count = 0;

  if (!profile) {
    return count;
  }

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

function getProfileSummary(profile) {
  if (!profile) {
    return 'This website inherits every global default.';
  }

  const details = [];

  if (profile.speed !== undefined) {
    details.push(`saved speed ${profile.speed}x`);
  }
  if (profile.startHidden !== undefined) {
    details.push(profile.startHidden ? 'controller starts hidden' : 'controller stays visible');
  }
  if (profile.audioBoolean !== undefined) {
    details.push(profile.audioBoolean ? 'audio is included' : 'audio is ignored');
  }
  if (Array.isArray(profile.keyBindings) && profile.keyBindings.length > 0) {
    details.push(
      `${profile.keyBindings.length} shortcut override${profile.keyBindings.length === 1 ? '' : 's'}`
    );
  }

  if (details.length === 0) {
    return 'This profile exists, but it is still inheriting your global defaults.';
  }

  return `This website uses ${details.join(', ')}.`;
}

function renderProfileEmptyState(listEl) {
  listEl.innerHTML = `
    <div class="empty-profiles">
      <p class="empty-profiles-title">No website profiles yet</p>
      <p class="empty-profiles-text">
        Start with the sites that always need different playback behavior, such as a faster learning
        site or a platform where you want custom shortcuts.
      </p>
    </div>
  `;
}

function renderSiteProfileList() {
  chrome.storage.sync.get({ siteProfiles: {} }, function (storage) {
    const profiles = storage.siteProfiles || {};
    const listEl = document.getElementById('site-profile-list');
    listEl.innerHTML = '';

    if (Object.keys(profiles).length === 0) {
      renderProfileEmptyState(listEl);
      return;
    }

    Object.entries(profiles)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([hostname, profile]) => {
        const entry = document.createElement('div');
        entry.className = 'site-profile-entry';
        entry.dataset.hostname = hostname;

        const speedVal = profile.speed !== undefined ? profile.speed : '';

        // Check if any advanced settings are customized
        const advancedFields = [
          {
            key: 'controllerOpacity',
            label: 'Controller opacity',
            type: 'number',
            step: '0.1',
            placeholder: 'Use global setting',
          },
          {
            key: 'controllerButtonSize',
            label: 'Controller button size',
            type: 'number',
            step: '1',
            placeholder: 'Use global setting',
          },
        ];

        const advFieldsHtml = advancedFields
          .map((f) => {
            const val = profile[f.key] !== undefined ? profile[f.key] : '';
            return `<label class="profile-field">
          <span class="profile-field-label">${f.label}</span>
          <input type="${f.type}" step="${f.step}" class="profile-input" data-key="${f.key}" value="${val}" placeholder="${f.placeholder}" />
          <span class="profile-field-note">Leave blank to inherit the global value.</span>
        </label>`;
          })
          .join('');

        const startHiddenChecked = profile.startHidden === true ? 'checked' : '';
        const audioBooleanChecked = profile.audioBoolean === false ? '' : 'checked';
        const hasStartHidden = profile.startHidden !== undefined;
        const hasAudioBoolean = profile.audioBoolean !== undefined;
        const hasCustomKb = Array.isArray(profile.keyBindings) && profile.keyBindings.length > 0;
        const kbRows = hasCustomKb
          ? profile.keyBindings
              .map((kb, i) =>
                buildProfileKeybindingRow(kb, i, CUSTOM_ACTIONS_NO_VALUES)
              )
              .join('')
          : '';

        const overrideCount = getProfileOverrideCount(profile);
        const summary = getProfileSummary(profile);
        const shortcutSummary = hasCustomKb
          ? `${profile.keyBindings.length} shortcut override${profile.keyBindings.length === 1 ? '' : 's'}`
          : 'Using global shortcuts';
        const hasExpanded =
          profile.controllerOpacity !== undefined ||
          profile.controllerButtonSize !== undefined ||
          hasStartHidden ||
          hasAudioBoolean ||
          hasCustomKb;

        entry.innerHTML = `
        <div class="profile-header">
          <span class="site-profile-host">${hostname}</span>
          <button class="site-profile-remove" data-hostname="${hostname}" title="Remove profile">&times;</button>
        </div>
        <p class="profile-summary">${summary}</p>
        <div class="profile-core">
          <label class="profile-field profile-speed-field">
            <span class="profile-field-label">Playback speed</span>
            <input type="number" step="0.1" class="profile-input" data-key="speed" value="${speedVal}" placeholder="Use global speed" />
          </label>
          <div class="profile-core-actions">
            <span class="profile-kb-status">${overrideCount > 0 ? overrideCount + ' override' + (overrideCount === 1 ? '' : 's') : 'Using globals'}</span>
            <button class="profile-advanced-toggle secondary" data-expanded="${hasExpanded}">${hasExpanded ? 'Hide extra controls' : 'More controls'}</button>
          </div>
        </div>
        <div class="profile-advanced ${hasExpanded ? 'expanded' : ''}">
          <div class="profile-fields profile-advanced-fields">
            ${advFieldsHtml}
            <label class="profile-field profile-checkbox">
              <input type="checkbox" class="profile-cb" data-key="startHidden" ${startHiddenChecked} ${hasStartHidden ? 'data-override="true"' : ''} />
              <span class="profile-field-label">Hide controller at start</span>
            </label>
            <label class="profile-field profile-checkbox">
              <input type="checkbox" class="profile-cb" data-key="audioBoolean" ${audioBooleanChecked} ${hasAudioBoolean ? 'data-override="true"' : ''} />
              <span class="profile-field-label">Include audio players</span>
            </label>
          </div>
          <div class="profile-shortcuts">
            <div class="profile-shortcuts-heading">
              <div>
                <p class="profile-panel-title">Shortcut overrides</p>
                <p class="profile-panel-note">${shortcutSummary}</p>
              </div>
            </div>
            <div class="profile-kb-list ${hasCustomKb ? 'expanded' : ''}">${hasCustomKb ? kbRows : '<div class="profile-kb-empty">Still using global shortcuts.</div>'}</div>
            <div class="profile-kb-actions">
              ${
                hasCustomKb
                  ? `<button class="profile-kb-add secondary" title="Add shortcut">Add shortcut</button>
                   <button class="profile-kb-reset secondary" title="Reset to global shortcuts">Use global shortcuts</button>`
                  : `<button class="profile-kb-customize secondary">Customize shortcuts</button>`
              }
            </div>
          </div>
        </div>
      `;
        listEl.appendChild(entry);
      });

    listEl.querySelectorAll('.profile-advanced-toggle').forEach((btn) => {
      btn.addEventListener('click', function () {
        const entry = this.closest('.site-profile-entry');
        const panel = entry.querySelector('.profile-advanced');
        const isExpanded = panel.classList.toggle('expanded');
        this.textContent = isExpanded ? 'Hide extra controls' : 'More controls';
        this.dataset.expanded = String(isExpanded);
      });
    });

    // Attach event handlers
    attachProfileInputHandlers(listEl);
    attachProfileCheckboxHandlers(listEl);
    attachProfileRemoveHandlers(listEl);
    attachProfileKeybindingHandlers(listEl);
  });
}

function attachProfileInputHandlers(listEl) {
  listEl.querySelectorAll('.profile-input').forEach((input) => {
    input.addEventListener('change', async function () {
      const entry = this.closest('.site-profile-entry');
      const host = entry.dataset.hostname;
      const key = this.dataset.key;
      const val = this.value.trim();

      await ensureConfig();
      if (val === '') {
        await config.setSiteProfile(host, { [key]: null });
      } else {
        await config.setSiteProfile(host, { [key]: parseFloat(val) });
      }
      renderSiteProfileList();
    });
  });
}

function attachProfileCheckboxHandlers(listEl) {
  listEl.querySelectorAll('.profile-cb').forEach((cb) => {
    cb.addEventListener('change', async function () {
      const entry = this.closest('.site-profile-entry');
      const host = entry.dataset.hostname;
      const key = this.dataset.key;
      this.dataset.override = 'true';

      await ensureConfig();
      await config.setSiteProfile(host, { [key]: this.checked });
      renderSiteProfileList();
    });
  });
}

function attachProfileRemoveHandlers(listEl) {
  listEl.querySelectorAll('.site-profile-remove').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const host = this.dataset.hostname;
      await ensureConfig();
      await config.removeSiteProfile(host);
      renderSiteProfileList();
    });
  });
}

function attachProfileKeybindingHandlers(listEl) {
  // "Customize shortcuts" — copy global bindings into profile
  listEl.querySelectorAll('.profile-kb-customize').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const entry = this.closest('.site-profile-entry');
      const host = entry.dataset.hostname;

      await ensureConfig();
      const globalKb =
        config.settings.keyBindings ||
        DEFAULT_SETTINGS.keyBindings;
      // Deep copy global bindings as starting point
      const copied = cloneGlobalBindings(globalKb);
      await config.setSiteProfile(host, { keyBindings: copied });
      renderSiteProfileList();
    });
  });

  // "Reset to global" — remove per-site bindings
  listEl.querySelectorAll('.profile-kb-reset').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const entry = this.closest('.site-profile-entry');
      const host = entry.dataset.hostname;

      await ensureConfig();
      await config.setSiteProfile(host, { keyBindings: null });
      renderSiteProfileList();
    });
  });

  // "Add" a new shortcut row
  listEl.querySelectorAll('.profile-kb-add').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const entry = this.closest('.site-profile-entry');
      const host = entry.dataset.hostname;

      await ensureConfig();
      const profile = config.getSiteProfile(host) || {};
      const kbs = Array.isArray(profile.keyBindings) ? [...profile.keyBindings] : [];
      kbs.push({ action: 'slower', key: null, value: 0.1, force: false });
      await config.setSiteProfile(host, { keyBindings: kbs });
      renderSiteProfileList();
    });
  });

  // Remove individual shortcut row
  listEl.querySelectorAll('.profile-kb-remove').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const entry = this.closest('.site-profile-entry');
      const host = entry.dataset.hostname;
      const index = parseInt(this.closest('.profile-kb-row').dataset.index);

      await ensureConfig();
      const profile = config.getSiteProfile(host) || {};
      const kbs = Array.isArray(profile.keyBindings) ? [...profile.keyBindings] : [];
      kbs.splice(index, 1);
      await config.setSiteProfile(host, {
        keyBindings: kbs.length > 0 ? kbs : null,
      });
      renderSiteProfileList();
    });
  });

  // Key press recording for per-site shortcut keys
  listEl.querySelectorAll('.profile-kb-key').forEach((input) => {
    // Initialize _keyCode from data attribute (set during render)
    const initialCode = input.dataset.keycode;
    input._keyCode =
      initialCode && initialCode !== 'null' && initialCode !== 'undefined'
        ? parseInt(initialCode)
        : null;
    input.addEventListener('focus', function () {
      this.value = '';
    });
    input.addEventListener('keydown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (BLACKLISTED_KEYCODES.includes(e.keyCode)) return;
      if (e.keyCode === 8) {
        this.value = '';
        this._keyCode = null;
        saveProfileKb(this);
        return;
      }
      if (e.keyCode === 27) {
        this.value = 'null';
        this._keyCode = null;
        saveProfileKb(this);
        return;
      }
      this.value = keyCodeToLabel(e.keyCode);
      this._keyCode = e.keyCode;
      saveProfileKb(this);
    });
    input.addEventListener('blur', function () {
      if (this._keyCode !== undefined) {
        this.value = keyCodeToLabel(this._keyCode);
      }
    });
  });

  // Action select change
  listEl.querySelectorAll('.profile-kb-action').forEach((select) => {
    select.addEventListener('change', function () {
      // Toggle value input visibility
      const row = this.closest('.profile-kb-row');
      const valueInput = row.querySelector('.profile-kb-value');
      const noValue = CUSTOM_ACTIONS_NO_VALUES.includes(this.value);
      valueInput.style.display = noValue ? 'none' : '';
      saveProfileKb(this);
    });
  });

  // Value input change
  listEl.querySelectorAll('.profile-kb-value').forEach((input) => {
    input.addEventListener('change', function () {
      saveProfileKb(this);
    });
  });
}

// Save the full keybindings array for a profile from DOM state
async function saveProfileKb(triggerEl) {
  const entry = triggerEl.closest('.site-profile-entry');
  const host = entry.dataset.hostname;
  const rows = entry.querySelectorAll('.profile-kb-row');

  const kbs = [];
  rows.forEach((row) => {
    const action = row.querySelector('.profile-kb-action').value;
    const keyInput = row.querySelector('.profile-kb-key');
    const key = keyInput._keyCode !== undefined ? keyInput._keyCode : null;
    const value = Number(row.querySelector('.profile-kb-value').value) || 0;
    kbs.push({ action, key, value, force: false });
  });

  await ensureConfig();
  await config.setSiteProfile(host, { keyBindings: kbs });
  renderSiteProfileList();
}

async function ensureConfig() {
  if (!config) {
    config = new VideoSpeedConfig();
    await config.load();
  }
}

async function addSiteProfile() {
  const hostnameInput = document.getElementById('site-profile-hostname');
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
  renderSiteProfileList();
  showStatusMessage(`Created a website profile for ${hostname}.`);
}

// Create debounced save function to prevent rapid saves
const debouncedSave = debounce(save_options, 300);

document.addEventListener('DOMContentLoaded', async function () {
  await restore_options();

  // Disable action dropdowns for predefined shortcuts
  document.querySelectorAll('.row.customs[id] .customDo').forEach((select) => {
    select.disabled = true;
  });

  document.getElementById('save').addEventListener('click', async (e) => {
    e.preventDefault();
    await save_options();
  });

  document.getElementById('add').addEventListener('click', add_shortcut);

  document.getElementById('restore').addEventListener('click', async (e) => {
    e.preventDefault();
    await restore_defaults();
  });

  document.getElementById('experimental').addEventListener('click', show_experimental);

  // Per-site speed management
  renderSiteProfileList();
  document.getElementById('site-profile-add-btn').addEventListener('click', addSiteProfile);
  document.getElementById('site-profile-hostname').addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await addSiteProfile();
    }
  });

  // About and feedback button event listeners
  document.getElementById('about').addEventListener('click', function () {
    window.open('https://github.com/igrigorik/videospeed');
  });

  document.getElementById('feedback').addEventListener('click', function () {
    window.open('https://github.com/igrigorik/videospeed/issues');
  });

  function eventCaller(event, className, funcName) {
    if (!event.target.classList.contains(className)) {
      return;
    }
    funcName(event);
  }

  document.addEventListener('keypress', (event) => {
    eventCaller(event, 'customValue', inputFilterNumbersOnly);
  });
  document.addEventListener('focus', (event) => {
    eventCaller(event, 'customKey', inputFocus);
  });
  document.addEventListener('blur', (event) => {
    eventCaller(event, 'customKey', inputBlur);
  });
  document.addEventListener('keydown', (event) => {
    eventCaller(event, 'customKey', recordKeyPress);
  });
  document.addEventListener('click', (event) => {
    eventCaller(event, 'removeParent', function () {
      event.target.parentNode.remove();
    });
  });
  document.addEventListener('change', (event) => {
    eventCaller(event, 'customDo', function () {
      const valueInput = event.target.nextElementSibling.nextElementSibling;
      if (CUSTOM_ACTIONS_NO_VALUES.includes(event.target.value)) {
        valueInput.style.display = 'none';
        valueInput.value = 0;
      } else {
        valueInput.style.display = 'inline-block';
      }
    });
  });
});
