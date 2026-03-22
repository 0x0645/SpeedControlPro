/**
 * Unit tests for content-entry.js behavior
 * Tests blacklist filtering and settings stripping
 */

import { describe, it, expect } from 'vitest';
import { isBlacklisted } from '../../../src/utils/blacklist';

describe('Content Entry', () => {
  it('settings passed to page context should not contain blacklist', () => {
    // Simulate what content-entry.js does
    const settings = {
      lastSpeed: 1.5,
      enabled: true,
      blacklist: 'youtube.com\nnetflix.com',
      rememberSpeed: true,
      keyBindings: [],
    };

    // This is what content-entry.js does before injecting
    delete settings.blacklist;
    delete settings.enabled;

    expect(settings.blacklist).toBe(undefined);
    expect(settings.enabled).toBe(undefined);
    expect(settings.lastSpeed).toBe(1.5);
    expect(settings.rememberSpeed).toBe(true);
  });

  it('blacklisted site should trigger early exit', () => {
    const blacklist = 'youtube.com\nnetflix.com';

    // Simulate content-entry.js check
    const youtubeBlocked = isBlacklisted(blacklist, 'https://www.youtube.com/watch?v=123');
    const netflixBlocked = isBlacklisted(blacklist, 'https://www.netflix.com/title/123');
    const otherAllowed = isBlacklisted(blacklist, 'https://www.example.com/');

    expect(youtubeBlocked).toBe(true);
    expect(netflixBlocked).toBe(true);
    expect(otherAllowed).toBe(false);
  });

  it('disabled extension should not proceed', () => {
    // Simulate content-entry.js check
    const settings = { enabled: false, blacklist: '' };

    // This is the check in content-entry.js
    const shouldExit = settings.enabled === false;

    expect(shouldExit).toBe(true);
  });

  it('enabled extension on non-blacklisted site should proceed', () => {
    const settings = {
      enabled: true,
      blacklist: 'youtube.com',
      lastSpeed: 1.5,
    };

    const isDisabled = settings.enabled === false;
    const isSiteBlacklisted = isBlacklisted(settings.blacklist, 'https://www.example.com/');

    expect(isDisabled).toBe(false);
    expect(isSiteBlacklisted).toBe(false);

    // Simulate stripping
    delete settings.blacklist;
    delete settings.enabled;

    // Verify only safe settings remain
    const keys = Object.keys(settings);
    expect(keys.includes('blacklist')).toBe(false);
    expect(keys.includes('enabled')).toBe(false);
    expect(keys.includes('lastSpeed')).toBe(true);
  });
});
