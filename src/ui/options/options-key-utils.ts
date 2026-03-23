import type { KeyBinding } from '../../types/settings';

export const BLACKLISTED_KEYCODES = Object.freeze([9, 16, 17, 18, 91, 92, 93, 224]);

export const KEY_CODE_ALIASES: Record<string, string> = Object.freeze({
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
});

export const ACTION_OPTIONS = Object.freeze([
  { value: 'slower', label: 'Decrease speed' },
  { value: 'faster', label: 'Increase speed' },
  { value: 'rewind', label: 'Rewind' },
  { value: 'advance', label: 'Advance' },
  { value: 'reset', label: 'Reset speed' },
  { value: 'fast', label: 'Preferred speed' },
  { value: 'muted', label: 'Mute' },
  { value: 'softer', label: 'Decrease volume' },
  { value: 'louder', label: 'Increase volume' },
  { value: 'pause', label: 'Pause' },
  { value: 'mark', label: 'Set marker' },
  { value: 'jump', label: 'Jump to marker' },
  { value: 'display', label: 'Show/hide controller' },
]);

export function keyCodeToLabel(keyCode: number | null | undefined): string {
  if (keyCode === null || keyCode === undefined) {
    return 'null';
  }

  return (
    KEY_CODE_ALIASES[String(keyCode)] ||
    (keyCode >= 48 && keyCode <= 90 ? String.fromCharCode(keyCode) : `Key ${keyCode}`)
  );
}

export function normalizeBindingForce(binding: KeyBinding & { force?: unknown }): KeyBinding {
  return {
    ...binding,
    force: Boolean(binding.force === 'true' || binding.force === true),
  };
}

export function normalizeKeyBindingsForce(
  keyBindings: Array<KeyBinding & { force?: unknown }>
): KeyBinding[] {
  return keyBindings.map((binding) => normalizeBindingForce(binding));
}
