/**
 * Unit tests for settings management
 * Using global variables to match browser extension architecture
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { wait } from '../../helpers/test-utils';
import { loadCoreModules } from '../../helpers/module-loader';
import type { StorageSnapshot } from '../../../src/types/contracts';

// Load all required modules
await loadCoreModules();

describe('Settings', () => {
  beforeEach(() => {
    // Clear any injected settings for clean tests
    if (window.VSC && window.VSC.StorageManager) {
      window.VSC.StorageManager.__resetForTests?.();
    }

    if (window.VSC && window.VSC.videoSpeedConfig) {
      window.VSC.videoSpeedConfig.__resetForTests?.();
    }
  });

  it('VideoSpeedConfig should initialize with default settings', () => {
    // Access VideoSpeedConfig from global scope
    const config = window.VSC.videoSpeedConfig;
    expect(config.settings).toBeDefined();
    expect(config.settings.enabled).toBe(true);
    expect(config.settings.lastSpeed).toBe(1.0);
    expect(config.settings.logLevel).toBe(3);
  });

  it('VideoSpeedConfig should load settings from storage', async () => {
    const config = window.VSC.videoSpeedConfig;
    const settings = await config.load();

    expect(settings).toBeDefined();
    expect(settings.enabled).toBe(true);
    expect(settings.lastSpeed).toBe(1.0);
  });

  it('VideoSpeedConfig should save settings to storage', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    await config.save({ lastSpeed: 2.0, enabled: false });

    expect(config.settings.lastSpeed).toBe(2.0);
    expect(config.settings.enabled).toBe(false);
  });

  it('VideoSpeedConfig should handle key bindings', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const config = new VideoSpeedConfig();

    // Load settings with defaults
    await config.load();

    const fasterValue = config.getKeyBinding('faster');
    expect(fasterValue).toBe(0.1);

    config.setKeyBinding('faster', 0.2);
    const updatedValue = config.getKeyBinding('faster');
    expect(updatedValue).toBe(0.2);
  });

  it('VideoSpeedConfig should have state manager available', () => {
    expect(window.VSC.stateManager).toBeDefined();
    expect(typeof window.VSC.stateManager!.getAllMediaElements).toBe('function');
    expect(typeof window.VSC.stateManager!.registerController).toBe('function');
    expect(typeof window.VSC.stateManager!.removeController).toBe('function');
  });

  it('VideoSpeedConfig should handle invalid key binding requests gracefully', () => {
    const config = window.VSC.videoSpeedConfig;

    const result = config.getKeyBinding('nonexistent');
    expect(result).toBe(false);

    // Should not throw
    config.setKeyBinding('nonexistent', 123);
  });

  it('VideoSpeedConfig should debounce lastSpeed saves', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const { StorageManager } = await import('../../../src/core/storage-manager');
    const config = new VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = StorageManager.set.bind(StorageManager);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = async () => {
      saveCount++;
    };

    // Multiple rapid speed updates
    await config.save({ lastSpeed: 1.5 });
    await config.save({ lastSpeed: 1.8 });
    await config.save({ lastSpeed: 2.0 });

    // Should not have saved yet
    expect(saveCount).toBe(0);
    expect(config.settings.lastSpeed).toBe(2.0); // In-memory should update immediately

    // Wait for debounce delay
    await wait(1100);

    expect(saveCount).toBe(1);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = originalSet;
  });

  it('VideoSpeedConfig should save non-speed settings immediately', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const { StorageManager } = await import('../../../src/core/storage-manager');
    const config = new VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = StorageManager.set.bind(StorageManager);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = async () => {
      saveCount++;
    };

    await config.save({ enabled: false });

    expect(saveCount).toBe(1);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = originalSet;
  });

  it('VideoSpeedConfig should reset debounce timer on new speed updates', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const { StorageManager } = await import('../../../src/core/storage-manager');
    const config = new VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = StorageManager.set.bind(StorageManager);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = async () => {
      saveCount++;
    };

    // First speed update
    await config.save({ lastSpeed: 1.5 });

    // Wait 500ms, then another update (should reset timer)
    await wait(500);
    await config.save({ lastSpeed: 2.0 });

    // Wait another 500ms (total 1000ms from first, but only 500ms from second)
    await wait(500);
    expect(saveCount).toBe(0); // Should not have saved yet

    // Wait remaining 600ms (total 1100ms from second update)
    await wait(600);
    expect(saveCount).toBe(1);
    expect(config.settings.lastSpeed).toBe(2.0);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = originalSet;
  });

  it('VideoSpeedConfig should persist only final speed value', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const { StorageManager } = await import('../../../src/core/storage-manager');
    const config = new VideoSpeedConfig();
    await config.load();

    let savedValue: number | null = null;
    const originalSet = StorageManager.set.bind(StorageManager);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = async (
      settings: { lastSpeed?: number }
    ) => {
      savedValue = settings.lastSpeed ?? null;
    };

    // Multiple rapid speed updates
    await config.save({ lastSpeed: 1.2 });
    await config.save({ lastSpeed: 1.7 });
    await config.save({ lastSpeed: 2.3 });

    // Wait for debounce
    await wait(1100);

    expect(savedValue).toBe(2.3);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = originalSet;
  });

  it('VideoSpeedConfig should update in-memory settings immediately during debounce', async () => {
    const { VideoSpeedConfig } = await import('../../../src/core/settings');
    const { StorageManager } = await import('../../../src/core/storage-manager');
    const config = new VideoSpeedConfig();
    await config.load();

    let saveCount = 0;
    const originalSet = StorageManager.set.bind(StorageManager);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = async () => {
      saveCount++;
    };

    // Speed update
    await config.save({ lastSpeed: 1.75 });

    // In-memory should update immediately, before storage save
    expect(config.settings.lastSpeed).toBe(1.75);
    expect(saveCount).toBe(0); // Storage not saved yet

    // Wait for debounce
    await wait(1100);
    expect(saveCount).toBe(1);

    (StorageManager as typeof StorageManager & { set: (data: StorageSnapshot) => Promise<void> }).set = originalSet;
  });
});
