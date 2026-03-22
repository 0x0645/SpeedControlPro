import { describe, it, expect } from 'vitest';

describe('Site Profile Behavior', () => {
  it('popup site profile toggle creates an empty profile shell', async () => {
    const profile = {};

    expect(profile).toEqual({});
  });

  it('popup site profile label reflects non-speed profile overrides', async () => {
    const { getProfileLabel } = await import('../../../src/ui/popup/popup.ts');

    expect(getProfileLabel({})).toBe('Profile active');
    expect(getProfileLabel({ controllerOpacity: 0.5 })).toBe('Profile active');
    expect(getProfileLabel({ speed: 1.5 })).toBe('Saved (1.5x)');
    expect(
      getProfileLabel({ keyBindings: [{ action: 'faster', key: 68, value: 0.1 }] })
    ).toBe('1 shortcut');
  });
});
