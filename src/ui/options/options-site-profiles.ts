import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { KeyBinding, SiteProfile } from '../../types/settings';
import { buildProfileKeybindingRow, cloneGlobalBindings } from './options-profile-utils';
import { keyCodeToLabel } from './options-key-utils';

type ConfigLike = {
  settings: {
    keyBindings?: KeyBinding[];
    siteProfiles?: Record<string, SiteProfile>;
  };
  getSiteProfile(hostname: string): SiteProfile | null;
  setSiteProfile(hostname: string, profileData: Partial<SiteProfile>): Promise<void>;
  removeSiteProfile(hostname: string): Promise<void>;
};

type ProfileKeyInput = HTMLInputElement & {
  _keyCode?: number | null;
};

type RenderSiteProfilesOptions = {
  config: ConfigLike;
  ensureConfig: () => Promise<void>;
  noValueActions: string[];
  blacklistedKeyCodes: number[];
};

type ProfileBinding = KeyBinding & {
  key: number | null;
};

function getProfileOverrideCount(profile: SiteProfile | null): number {
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

function getProfileSummary(profile: SiteProfile | null): string {
  if (!profile) {
    return 'This website inherits every global default.';
  }

  const details: string[] = [];

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

function renderProfileEmptyState(listEl: HTMLElement): void {
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

function getProfileEntry(element: Element): HTMLElement {
  return element.closest('.site-profile-entry') as HTMLElement;
}

function getProfileHost(element: Element): string {
  return getProfileEntry(element).dataset.hostname as string;
}

function getProfileRows(entry: HTMLElement): HTMLElement[] {
  return Array.from(entry.querySelectorAll('.profile-kb-row')) as HTMLElement[];
}

async function saveProfileKeybindings(
  triggerEl: Element,
  options: RenderSiteProfilesOptions
): Promise<void> {
  const entry = getProfileEntry(triggerEl);
  const host = getProfileHost(triggerEl);
  const rows = getProfileRows(entry);

  const keyBindings = rows.map((row) => {
    const action = (row.querySelector('.profile-kb-action') as HTMLSelectElement).value;
    const keyInput = row.querySelector('.profile-kb-key') as ProfileKeyInput;
    const value = Number((row.querySelector('.profile-kb-value') as HTMLInputElement).value) || 0;

    return {
      action,
      key: keyInput._keyCode !== undefined ? keyInput._keyCode : null,
      value,
      force: false,
    } as ProfileBinding;
  });

  await options.ensureConfig();
  await options.config.setSiteProfile(host, { keyBindings: keyBindings as KeyBinding[] });
  await renderSiteProfileList(options);
}

function attachProfileInputHandlers(listEl: HTMLElement, options: RenderSiteProfilesOptions): void {
  listEl.querySelectorAll('.profile-input').forEach((inputEl) => {
    inputEl.addEventListener('change', async (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const host = getProfileHost(input);
      const key = input.dataset.key as keyof SiteProfile;
      const value = input.value.trim();

      await options.ensureConfig();
      if (value === '') {
        await options.config.setSiteProfile(host, { [key]: null });
      } else {
        await options.config.setSiteProfile(host, { [key]: parseFloat(value) });
      }
      await renderSiteProfileList(options);
    });
  });
}

function attachProfileCheckboxHandlers(
  listEl: HTMLElement,
  options: RenderSiteProfilesOptions
): void {
  listEl.querySelectorAll('.profile-cb').forEach((checkboxEl) => {
    checkboxEl.addEventListener('change', async (event) => {
      const checkbox = event.currentTarget as HTMLInputElement;
      const host = getProfileHost(checkbox);
      const key = checkbox.dataset.key as keyof SiteProfile;
      checkbox.dataset.override = 'true';

      await options.ensureConfig();
      await options.config.setSiteProfile(host, { [key]: checkbox.checked });
      await renderSiteProfileList(options);
    });
  });
}

function attachProfileRemoveHandlers(
  listEl: HTMLElement,
  options: RenderSiteProfilesOptions
): void {
  listEl.querySelectorAll('.site-profile-remove').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async (event) => {
      const host = (event.currentTarget as HTMLButtonElement).dataset.hostname as string;
      await options.ensureConfig();
      await options.config.removeSiteProfile(host);
      await renderSiteProfileList(options);
    });
  });
}

function attachProfileKeybindingHandlers(
  listEl: HTMLElement,
  options: RenderSiteProfilesOptions
): void {
  listEl.querySelectorAll('.profile-kb-customize').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async (event) => {
      const host = getProfileHost(event.currentTarget as HTMLElement);
      await options.ensureConfig();

      const globalKeyBindings = options.config.settings.keyBindings || DEFAULT_SETTINGS.keyBindings;
      const copiedBindings = cloneGlobalBindings(
        globalKeyBindings as unknown as Array<Record<string, unknown>>
      ) as unknown as KeyBinding[];
      await options.config.setSiteProfile(host, { keyBindings: copiedBindings });
      await renderSiteProfileList(options);
    });
  });

  listEl.querySelectorAll('.profile-kb-reset').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async (event) => {
      const host = getProfileHost(event.currentTarget as HTMLElement);
      await options.ensureConfig();
      await options.config.setSiteProfile(host, { keyBindings: null });
      await renderSiteProfileList(options);
    });
  });

  listEl.querySelectorAll('.profile-kb-add').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async (event) => {
      const host = getProfileHost(event.currentTarget as HTMLElement);
      await options.ensureConfig();

      const profile = options.config.getSiteProfile(host) || {};
      const keyBindings = Array.isArray(profile.keyBindings)
        ? ([...profile.keyBindings] as ProfileBinding[])
        : [];
      keyBindings.push({
        action: 'slower',
        key: null,
        value: 0.1,
        force: false,
      } as unknown as ProfileBinding);
      await options.config.setSiteProfile(host, { keyBindings: keyBindings as KeyBinding[] });
      await renderSiteProfileList(options);
    });
  });

  listEl.querySelectorAll('.profile-kb-remove').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async (event) => {
      const target = event.currentTarget as HTMLElement;
      const host = getProfileHost(target);
      const row = target.closest('.profile-kb-row') as HTMLElement;
      const index = parseInt(row.dataset.index as string, 10);
      await options.ensureConfig();

      const profile = options.config.getSiteProfile(host) || {};
      const keyBindings = Array.isArray(profile.keyBindings)
        ? ([...profile.keyBindings] as ProfileBinding[])
        : [];
      keyBindings.splice(index, 1);
      await options.config.setSiteProfile(host, {
        keyBindings: keyBindings.length > 0 ? keyBindings : null,
      });
      await renderSiteProfileList(options);
    });
  });

  listEl.querySelectorAll('.profile-kb-key').forEach((inputEl) => {
    const input = inputEl as ProfileKeyInput;
    const initialCode = input.dataset.keycode;
    input._keyCode =
      initialCode && initialCode !== 'null' && initialCode !== 'undefined'
        ? parseInt(initialCode, 10)
        : null;

    input.addEventListener('focus', (event) => {
      (event.currentTarget as HTMLInputElement).value = '';
    });

    input.addEventListener('keydown', (event) => {
      const keyInput = event.currentTarget as ProfileKeyInput;
      event.preventDefault();
      event.stopPropagation();

      if (options.blacklistedKeyCodes.includes(event.keyCode)) {
        return;
      }
      if (event.keyCode === 8) {
        keyInput.value = '';
        keyInput._keyCode = null;
        void saveProfileKeybindings(keyInput, options);
        return;
      }
      if (event.keyCode === 27) {
        keyInput.value = 'null';
        keyInput._keyCode = null;
        void saveProfileKeybindings(keyInput, options);
        return;
      }

      keyInput.value = keyCodeToLabel(event.keyCode);
      keyInput._keyCode = event.keyCode;
      void saveProfileKeybindings(keyInput, options);
    });

    input.addEventListener('blur', (event) => {
      const keyInput = event.currentTarget as ProfileKeyInput;
      if (keyInput._keyCode !== undefined) {
        keyInput.value = keyCodeToLabel(keyInput._keyCode);
      }
    });
  });

  listEl.querySelectorAll('.profile-kb-action').forEach((selectEl) => {
    selectEl.addEventListener('change', (event) => {
      const select = event.currentTarget as HTMLSelectElement;
      const row = select.closest('.profile-kb-row') as HTMLElement;
      const valueInput = row.querySelector('.profile-kb-value') as HTMLInputElement;
      const noValue = options.noValueActions.includes(select.value);
      valueInput.style.display = noValue ? 'none' : '';
      void saveProfileKeybindings(select, options);
    });
  });

  listEl.querySelectorAll('.profile-kb-value').forEach((inputEl) => {
    inputEl.addEventListener('change', (event) => {
      void saveProfileKeybindings(event.currentTarget as HTMLInputElement, options);
    });
  });
}

export async function renderSiteProfileList(options: RenderSiteProfilesOptions): Promise<void> {
  await options.ensureConfig();

  const profiles = options.config.settings.siteProfiles || {};
  const listEl = document.getElementById('site-profile-list') as HTMLElement;
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

      const speedValue = profile.speed !== undefined ? profile.speed : '';
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
      ] as const;

      const advancedFieldsHtml = advancedFields
        .map((field) => {
          const value = profile[field.key] !== undefined ? profile[field.key] : '';
          return `<label class="profile-field">
          <span class="profile-field-label">${field.label}</span>
          <input type="${field.type}" step="${field.step}" class="profile-input" data-key="${field.key}" value="${value}" placeholder="${field.placeholder}" />
          <span class="profile-field-note">Leave blank to inherit the global value.</span>
        </label>`;
        })
        .join('');

      const startHiddenChecked = profile.startHidden === true ? 'checked' : '';
      const audioBooleanChecked = profile.audioBoolean === false ? '' : 'checked';
      const hasStartHidden = profile.startHidden !== undefined;
      const hasAudioBoolean = profile.audioBoolean !== undefined;
      const hasCustomBindings =
        Array.isArray(profile.keyBindings) && profile.keyBindings.length > 0;
      const shortcutRows = hasCustomBindings
        ? (profile.keyBindings as KeyBinding[])
            .map((binding, index) =>
              buildProfileKeybindingRow(binding, index, options.noValueActions)
            )
            .join('')
        : '';

      const overrideCount = getProfileOverrideCount(profile);
      const summary = getProfileSummary(profile);
      const shortcutSummary = hasCustomBindings
        ? `${(profile.keyBindings as KeyBinding[]).length} shortcut override${(profile.keyBindings as KeyBinding[]).length === 1 ? '' : 's'}`
        : 'Using global shortcuts';
      const hasExpanded =
        profile.controllerOpacity !== undefined ||
        profile.controllerButtonSize !== undefined ||
        hasStartHidden ||
        hasAudioBoolean ||
        hasCustomBindings;

      entry.innerHTML = `
        <div class="profile-header">
          <span class="site-profile-host">${hostname}</span>
          <button class="site-profile-remove" data-hostname="${hostname}" title="Remove profile">&times;</button>
        </div>
        <p class="profile-summary">${summary}</p>
        <div class="profile-core">
          <label class="profile-field profile-speed-field">
            <span class="profile-field-label">Playback speed</span>
            <input type="number" step="0.1" class="profile-input" data-key="speed" value="${speedValue}" placeholder="Use global speed" />
          </label>
          <div class="profile-core-actions">
            <span class="profile-kb-status">${overrideCount > 0 ? `${overrideCount} override${overrideCount === 1 ? '' : 's'}` : 'Using globals'}</span>
            <button class="profile-advanced-toggle secondary" data-expanded="${hasExpanded}">${hasExpanded ? 'Hide extra controls' : 'More controls'}</button>
          </div>
        </div>
        <div class="profile-advanced ${hasExpanded ? 'expanded' : ''}">
          <div class="profile-fields profile-advanced-fields">
            ${advancedFieldsHtml}
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
            <div class="profile-kb-list ${hasCustomBindings ? 'expanded' : ''}">${hasCustomBindings ? shortcutRows : '<div class="profile-kb-empty">Still using global shortcuts.</div>'}</div>
            <div class="profile-kb-actions">
              ${
                hasCustomBindings
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

  listEl.querySelectorAll('.profile-advanced-toggle').forEach((buttonEl) => {
    buttonEl.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const entry = button.closest('.site-profile-entry') as HTMLElement;
      const panel = entry.querySelector('.profile-advanced') as HTMLElement;
      const isExpanded = panel.classList.toggle('expanded');
      button.textContent = isExpanded ? 'Hide extra controls' : 'More controls';
      button.dataset.expanded = String(isExpanded);
    });
  });

  attachProfileInputHandlers(listEl, options);
  attachProfileCheckboxHandlers(listEl, options);
  attachProfileRemoveHandlers(listEl, options);
  attachProfileKeybindingHandlers(listEl, options);
}
