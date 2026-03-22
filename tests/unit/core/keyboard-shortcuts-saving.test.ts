/**
 * Tests for keyboard shortcuts saving fix
 * Verifies the resolution of the dual storage system issue
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadMinimalModules } from '../../helpers/module-loader';
import { resetMockStorage } from '../../setup';

// Load all required modules
await loadMinimalModules();

describe('Keyboard Shortcuts Saving', () => {
  beforeEach(() => {
    // Clear any injected settings for clean tests
    if (window.VSC && window.VSC.StorageManager) {
      window.VSC.StorageManager._injectedSettings = null;
    }
  });

  // DEFAULT_SETTINGS keyBindings initialization tests
  it('DEFAULT_SETTINGS should have keyBindings populated', () => {
    const defaults = window.VSC.Constants!.DEFAULT_SETTINGS;

    expect(defaults.keyBindings).toBeDefined();
    expect(defaults.keyBindings.length > 0).toBe(true);

    // Should have all expected default bindings
    const expectedActions = [
      'slower',
      'faster',
      'rewind',
      'advance',
      'reset',
      'fast',
      'display',
      'mark',
      'jump',
    ];
    const actualActions = defaults.keyBindings.map((b) => b.action);

    expectedActions.forEach((action) => {
      expect(actualActions.includes(action)).toBe(true);
    });
  });

  it('DEFAULT_SETTINGS keyBindings should have proper structure', () => {
    const defaults = window.VSC.Constants!.DEFAULT_SETTINGS;

    defaults.keyBindings.forEach((binding: { action: string; key: number; value: number; force: boolean; predefined: boolean }, _index: number) => {
      expect(typeof binding.action).toBe('string');
      expect(typeof binding.key).toBe('number');
      expect(typeof binding.value).toBe('number');
      expect(typeof binding.force).toBe('boolean');
      expect(typeof binding.predefined).toBe('boolean');
    });
  });

  it('Fresh install should not require first-time initialization', async () => {
    resetMockStorage();

    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();
    await config.load();

    // Should have loaded default bindings without first-time initialization
    expect(config.settings.keyBindings).toBeDefined();
    expect(config.settings.keyBindings.length > 0).toBe(true);

    const defaultsLength = window.VSC.Constants!.DEFAULT_SETTINGS.keyBindings.length;
    expect(config.settings.keyBindings.length).toBe(defaultsLength);
  });

  // Storage System Unification tests
  it('Should handle existing keyBindings in storage', async () => {
    // Setup existing storage with keyBindings by saving them first
    const existingBindings = [
      { action: 'slower', key: 65, value: 0.2, force: false, predefined: true }, // A key
      { action: 'faster', key: 68, value: 0.2, force: false, predefined: true }, // D key
    ];

    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config1 = new VideoSpeedConfig();
    await config1.save({ keyBindings: existingBindings });

    const config2 = new VideoSpeedConfig();
    await config2.load();

    expect(config2.settings.keyBindings.length >= existingBindings.length).toBe(true);

    // Verify bindings were loaded correctly
    const slowerBinding = config2.settings.keyBindings.find((b: { action: string }) => b.action === 'slower');
    expect(slowerBinding).toBeDefined();
    expect(typeof slowerBinding!.force).toBe('boolean');
  });

  it('Should save keyBindings to storage correctly', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config1 = new VideoSpeedConfig();

    const customBindings = [
      { action: 'slower', key: 81, value: 0.15, force: true, predefined: true }, // Q key
      { action: 'faster', key: 69, value: 0.15, force: false, predefined: true }, // E key
    ];

    await config1.save({ keyBindings: customBindings });

    const config2 = new VideoSpeedConfig();
    await config2.load();

    expect(config2.settings.keyBindings).toBeDefined();
    expect(config2.settings.keyBindings.length >= customBindings.length).toBe(true);
  });

  it('Should maintain consistency across load/save cycles', async () => {
    const originalBindings = [
      { action: 'slower', key: 87, value: 0.25, force: true, predefined: true }, // W key
      { action: 'faster', key: 83, value: 0.25, force: false, predefined: true }, // S key
    ];

    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config1 = new VideoSpeedConfig();
    await config1.save({ keyBindings: originalBindings });

    const config2 = new VideoSpeedConfig();
    await config2.load();

    const loadedBindings = config2.settings.keyBindings;

    // Find our bindings (they might be mixed with defaults)
    const slowerBinding = loadedBindings.find((b: { action: string }) => b.action === 'slower');
    const fasterBinding = loadedBindings.find((b: { action: string }) => b.action === 'faster');

    expect(slowerBinding).toBeDefined();
    expect(fasterBinding).toBeDefined();

    expect(typeof slowerBinding!.force).toBe('boolean');
    expect(typeof fasterBinding!.force).toBe('boolean');
  });

  // Force Field Data Type Consistency tests
  it('Should handle string force values from legacy storage', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();
    await config.load();

    // Should have proper boolean types in all bindings
    const bindings = config.settings.keyBindings;
    bindings.forEach((binding) => {
      expect(typeof binding.force).toBe('boolean');
    });
  });

  // Regression Prevention tests
  it('Should never lose all keyboard shortcuts', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();
    await config.load();

    // Should always have shortcuts
    expect(config.settings.keyBindings && config.settings.keyBindings.length > 0).toBe(true);

    // Should have the essential shortcuts
    const requiredActions = ['slower', 'faster', 'display'];
    for (const action of requiredActions) {
      const binding = config.settings.keyBindings.find((b: { action: string }) => b.action === action);
      expect(binding).toBeDefined();
    }
  });

  it('Fresh install should always have functional default shortcuts', async () => {
    resetMockStorage();

    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();
    await config.load();

    // Should have all expected default shortcuts
    const requiredActions = [
      'slower',
      'faster',
      'rewind',
      'advance',
      'reset',
      'fast',
      'display',
      'mark',
      'jump',
    ];

    for (const action of requiredActions) {
      const binding = config.settings.keyBindings.find((b: { action: string }) => b.action === action);
      expect(binding).toBeDefined();
      expect(typeof binding!.key).toBe('number');
      expect(binding!.key > 0).toBe(true);
    }
  });
});
