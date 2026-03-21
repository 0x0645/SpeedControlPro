import type { VideoSpeedConfig } from '../../core/settings';
import type { KeyBinding } from '../../types/settings';
import { BLACKLISTED_KEYCODES, keyCodeToLabel } from './options-key-utils';

type ShortcutKeyInput = HTMLInputElement & { keyCode?: number | null };
type ShortcutBinding = Omit<KeyBinding, 'key'> & { key: number | null };

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  return root.querySelector(selector) as T;
}

function getShortcutKeyInput(root: ParentNode, selector: string): ShortcutKeyInput {
  return queryRequired<ShortcutKeyInput>(root, selector);
}

function getValueInput(root: ParentNode, selector: string): HTMLInputElement {
  return queryRequired<HTMLInputElement>(root, selector);
}

function getSelect(root: ParentNode, selector: string): HTMLSelectElement {
  return queryRequired<HTMLSelectElement>(root, selector);
}

export function recordKeyPress(e: KeyboardEvent): void {
  const target = e.target as ShortcutKeyInput;

  if (e.keyCode === 8) {
    target.value = '';
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.keyCode === 27) {
    target.value = 'null';
    target.keyCode = null;
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (BLACKLISTED_KEYCODES.includes(e.keyCode)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  target.value = keyCodeToLabel(e.keyCode);
  target.keyCode = e.keyCode;
  e.preventDefault();
  e.stopPropagation();
}

export function inputFilterNumbersOnly(e: KeyboardEvent): void {
  const target = e.target as HTMLInputElement;
  const char = String.fromCharCode(e.keyCode);
  if (!/[\d.]$/.test(char) || !/^\d+(\.\d*)?$/.test(target.value + char)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export function inputFocus(e: FocusEvent): void {
  (e.target as HTMLInputElement).value = '';
}

export function inputBlur(e: FocusEvent): void {
  const target = e.target as ShortcutKeyInput;
  target.value = keyCodeToLabel(target.keyCode);
}

export function updateCustomShortcutInputText(
  inputItem: ShortcutKeyInput,
  keyCode: number | null | undefined
): void {
  inputItem.value = keyCodeToLabel(keyCode);
  inputItem.keyCode = keyCode;
}

export function addShortcut(): HTMLElement {
  const html = `<select class="customDo">
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

  const div = document.createElement('div');
  div.setAttribute('class', 'row customs');
  div.innerHTML = html;

  const customsElement = document.getElementById('customs') as HTMLElement;
  const addButton = document.getElementById('add') as HTMLElement;
  customsElement.insertBefore(div, addButton);

  const experimentalButton = document.getElementById('experimental') as HTMLButtonElement;
  if (experimentalButton && experimentalButton.disabled) {
    const customValue = getValueInput(div, '.customValue');
    const select = document.createElement('select');
    select.className = 'customForce show';
    select.innerHTML = `
      <option value="false">Default behavior</option>
      <option value="true">Override site keys</option>
    `;
    customValue.parentNode?.insertBefore(select, customValue.nextSibling);
  }

  return div;
}

export function createShortcutBinding(item: HTMLElement): ShortcutBinding {
  const action = getSelect(item, '.customDo').value;
  const key = getShortcutKeyInput(item, '.customKey').keyCode ?? null;
  const value = Number(getValueInput(item, '.customValue').value);
  const forceElement = item.querySelector('.customForce') as HTMLSelectElement | null;

  return {
    action,
    key,
    value,
    force: forceElement ? forceElement.value : 'false',
    predefined: !!item.id,
  };
}

export function showExperimental(config: VideoSpeedConfig): void {
  const button = document.getElementById('experimental') as HTMLButtonElement;
  const customRows = document.querySelectorAll('.row.customs');
  const advancedRows = document.querySelectorAll('.row.advanced-feature');

  advancedRows.forEach((row) => {
    row.classList.add('show');
  });

  const createForceSelect = () => {
    const select = document.createElement('select');
    select.className = 'customForce show';
    select.innerHTML = `
      <option value="false">Allow event propagation</option>
      <option value="true">Disable event propagation</option>
    `;
    return select;
  };

  customRows.forEach((row) => {
    const existingSelect = row.querySelector<HTMLSelectElement>('.customForce');
    if (existingSelect) {
      existingSelect.classList.add('show');
      return;
    }

    const customValue = row.querySelector<HTMLInputElement>('.customValue');
    const newSelect = createForceSelect();
    const rowId = row.id;

    if (rowId && config.settings.keyBindings) {
      const savedBinding = config.settings.keyBindings.find((binding) => binding.action === rowId);
      if (savedBinding && savedBinding.force !== undefined) {
        newSelect.value = String(savedBinding.force);
      }
    } else if (!rowId) {
      const rowIndex = Array.from(
        (row.parentElement as HTMLElement).querySelectorAll('.row.customs:not([id])')
      ).indexOf(row);
      const customBindings =
        config.settings.keyBindings?.filter((binding) => !binding.predefined) || [];
      if (customBindings[rowIndex] && customBindings[rowIndex].force !== undefined) {
        newSelect.value = String(customBindings[rowIndex].force);
      }
    }

    if (customValue) {
      customValue.parentNode?.insertBefore(newSelect, customValue.nextSibling);
    }
  });

  button.textContent = 'Advanced features enabled';
  button.disabled = true;
}
