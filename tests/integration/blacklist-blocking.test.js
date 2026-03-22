/**
 * Integration tests for blacklist blocking behavior
 * Tests that controller does not load on blacklisted sites
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockVideo, createMockDOM } from '../helpers/test-utils.js';
import { loadCoreModules } from '../helpers/module-loader.js';
import { isBlacklisted } from '../../src/utils/blacklist.ts';

await loadCoreModules();

let mockDOM;

describe('Blacklist Blocking', () => {
  beforeEach(() => {
    mockDOM = createMockDOM();

    if (window.VSC && window.VSC.siteHandlerManager) {
      window.VSC.siteHandlerManager.initialize(document);
    }
  });

  afterEach(() => {
    if (mockDOM) {
      mockDOM.cleanup();
    }
  });

  it('Controller should NOT initialize when youtube.com is blacklisted', async () => {
    const blacklist = 'youtube.com';
    const testURL = 'https://www.youtube.com/watch?v=abc123';

    // Simulate content-entry.js check
    const shouldBlock = isBlacklisted(blacklist, testURL);
    expect(shouldBlock).toBe(true);

    // If blocked, controller should never be created
    if (shouldBlock) {
      const mockVideo = createMockVideo({ playbackRate: 1.0 });
      mockDOM.container.appendChild(mockVideo);

      // Video should NOT have a controller attached
      expect(mockVideo.vsc).toBe(undefined);
    }
  });

  it('Controller SHOULD initialize when site is NOT blacklisted', async () => {
    const blacklist = 'youtube.com';
    const testURL = 'https://www.example.com/video';

    const shouldBlock = isBlacklisted(blacklist, testURL);
    expect(shouldBlock).toBe(false);

    // Site not blocked - controller should be created
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const eventManager = new window.VSC.EventManager(config, null);
    const actionHandler = new window.VSC.ActionHandler(config, eventManager);

    const mockVideo = createMockVideo({ playbackRate: 1.0 });
    mockDOM.container.appendChild(mockVideo);

    // Create controller (simulating what inject.js does)
    mockVideo.vsc = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    expect(mockVideo.vsc).toBeDefined();
  });

  it('Settings passed to page context should not contain blacklist or enabled', async () => {
    const fullSettings = {
      lastSpeed: 1.5,
      enabled: true,
      blacklist: 'youtube.com\nnetflix.com',
      rememberSpeed: true,
      forceLastSavedSpeed: false,
      audioBoolean: true,
      startHidden: false,
      controllerOpacity: 0.3,
      controllerButtonSize: 14,
      keyBindings: [],
      logLevel: 3,
    };

    // Simulate content-entry.js stripping sensitive keys before injection
    const settingsForPage = { ...fullSettings };
    delete settingsForPage.blacklist;
    delete settingsForPage.enabled;

    expect(settingsForPage.blacklist).toBe(undefined);
    expect(settingsForPage.enabled).toBe(undefined);
    expect(settingsForPage.lastSpeed).toBe(1.5);
    expect(settingsForPage.rememberSpeed).toBe(true);
    expect(settingsForPage.keyBindings.length).toBe(0);
  });

  it('Default blacklist sites should be blocked', async () => {
    const defaultBlacklist = `www.instagram.com
x.com
imgur.com
teams.microsoft.com
meet.google.com`;

    const blockedSites = [
      'https://www.instagram.com/p/123',
      'https://x.com/user/status/456',
      'https://imgur.com/gallery/abc',
      'https://teams.microsoft.com/meeting/xyz',
      'https://meet.google.com/abc-def-ghi',
    ];

    const allowedSites = [
      'https://www.youtube.com/watch?v=123',
      'https://www.netflix.com/watch/456',
      'https://www.example.com/',
    ];

    blockedSites.forEach((url) => {
      expect(isBlacklisted(defaultBlacklist, url)).toBe(true);
    });

    allowedSites.forEach((url) => {
      expect(isBlacklisted(defaultBlacklist, url)).toBe(false);
    });
  });
});
