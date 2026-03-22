import { describe, it, expect } from 'vitest';

describe('Options Helpers', () => {
  it('options key helpers normalize key labels and force flags', async () => {
    const { keyCodeToLabel, normalizeKeyBindingsForce } =
      await import('../../../src/ui/options/options-key-utils.ts');

    expect(keyCodeToLabel(124)).toBe('F13');
    expect(keyCodeToLabel(null)).toBe('null');

    const normalized = normalizeKeyBindingsForce([
      { action: 'faster', key: 68, value: 0.1, force: 'true', predefined: true },
      { action: 'slower', key: 83, value: 0.1, force: false, predefined: true },
    ]);

    expect(normalized[0].force).toBe(true);
    expect(normalized[1].force).toBe(false);
  });

  it('options profile helpers build rows and clone bindings', async () => {
    const { buildProfileKeybindingRow, cloneGlobalBindings } =
      await import('../../../src/ui/options/options-profile-utils.ts');

    const html = buildProfileKeybindingRow({ action: 'display', key: 86, value: 0 }, 0, [
      'display',
      'pause',
    ]);

    expect(html.includes('profile-kb-row')).toBe(true);
    expect(html.includes('display:none')).toBe(true);

    const cloned = cloneGlobalBindings([{ action: 'faster', key: 68, value: 0.1, predefined: true }]);

    expect(cloned[0].predefined).toBe(false);
    expect(cloned[0].action).toBe('faster');
  });
});
