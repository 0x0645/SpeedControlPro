import type { KeyBinding } from '../../types/settings';
import { ACTION_OPTIONS, keyCodeToLabel } from './options-key-utils';

export function buildProfileKeybindingRow(
  binding: { action: string; key: number | null; value: number },
  index: number,
  noValueActions: string[]
): string {
  const actionOptionsHtml = ACTION_OPTIONS.map(
    (opt) =>
      `<option value="${opt.value}" ${opt.value === binding.action ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  const noValue = noValueActions.includes(binding.action);

  return `<div class="profile-kb-row" data-index="${index}">
    <select class="profile-kb-action">${actionOptionsHtml}</select>
    <input class="profile-kb-key" type="text" value="${keyCodeToLabel(binding.key)}" data-keycode="${binding.key}" placeholder="key" readonly />
    <input class="profile-kb-value" type="text" value="${binding.value !== undefined ? binding.value : ''}" placeholder="value" ${noValue ? 'style="display:none"' : ''} />
    <button class="profile-kb-remove" title="Remove shortcut">X</button>
  </div>`;
}

export function cloneGlobalBindings(bindings: KeyBinding[]): KeyBinding[] {
  return bindings.map((binding) => ({ ...binding, predefined: false }));
}
