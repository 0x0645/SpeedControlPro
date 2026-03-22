/**
 * Unit tests for blacklist regex parsing
 * Tests regex patterns with and without flags
 */

import { describe, it, expect } from 'vitest';
import { isBlacklisted } from '../../../src/utils/blacklist';

describe('Blacklist Regex', () => {
  it('should parse regex patterns WITHOUT flags', () => {
    const blacklist = '/(.+)youtube\\.com(\\/*)$/';

    const testCases = [
      { url: 'https://www.youtube.com/', shouldMatch: true },
      { url: 'https://music.youtube.com/', shouldMatch: true },
      { url: 'https://m.youtube.com/', shouldMatch: true },
      { url: 'https://example.com/', shouldMatch: false },
    ];

    testCases.forEach(({ url, shouldMatch }) => {
      const result = isBlacklisted(blacklist, url);
      expect(result).toBe(shouldMatch);
    });
  });

  it('should parse regex patterns WITH flags', () => {
    const blacklist = '/(.+)youtube\\.com(\\/*)$/gi';

    const testCases = [
      { url: 'https://www.youtube.com/', shouldMatch: true },
      { url: 'https://YOUTUBE.COM/', shouldMatch: true }, // case insensitive with 'i' flag
      { url: 'https://music.youtube.com/', shouldMatch: true },
      { url: 'https://example.com/', shouldMatch: false },
    ];

    testCases.forEach(({ url, shouldMatch }) => {
      const result = isBlacklisted(blacklist, url);
      expect(result).toBe(shouldMatch);
    });
  });

  it('should handle simple string patterns', () => {
    const blacklist = 'youtube.com';
    const result = isBlacklisted(blacklist, 'https://www.youtube.com/watch?v=123');
    expect(result).toBe(true);
  });

  it('should handle multiple blacklist entries with mixed formats', () => {
    const blacklist = `youtube.com
/(.+)instagram\\.com/
/twitter\\.com/gi`;

    const testCases = [
      { url: 'https://www.youtube.com/', shouldMatch: true },
      { url: 'https://www.instagram.com/', shouldMatch: true },
      { url: 'https://twitter.com/', shouldMatch: true },
      { url: 'https://TWITTER.COM/', shouldMatch: true }, // case insensitive
      { url: 'https://example.com/', shouldMatch: false },
    ];

    testCases.forEach(({ url, shouldMatch }) => {
      const result = isBlacklisted(blacklist, url);
      expect(result).toBe(shouldMatch);
    });
  });

  it('should handle malformed regex patterns gracefully', () => {
    const blacklist = `//
/[unclosed
/valid\\.com/`;

    // Should not throw and should match the valid pattern
    let result;
    let threwError = false;
    try {
      result = isBlacklisted(blacklist, 'https://valid.com/');
    } catch {
      threwError = true;
    }

    expect(threwError).toBe(false);
    expect(result).toBe(true);
  });

  it('should handle empty patterns', () => {
    const blacklist = `

youtube.com

`;

    const result = isBlacklisted(blacklist, 'https://www.youtube.com/');
    expect(result).toBe(true);
  });

  it('should not match partial domain names (x.com should not match netflix.com)', () => {
    const blacklist = 'x.com';

    const testCases = [
      { url: 'https://x.com/', shouldMatch: true },
      { url: 'https://www.x.com/', shouldMatch: true },
      { url: 'https://x.com/status/123', shouldMatch: true },
      { url: 'https://netflix.com/', shouldMatch: false }, // Should NOT match
      { url: 'https://max.com/', shouldMatch: false }, // Should NOT match
      { url: 'https://fox.com/', shouldMatch: false }, // Should NOT match
    ];

    testCases.forEach(({ url, shouldMatch }) => {
      const result = isBlacklisted(blacklist, url);
      expect(result).toBe(shouldMatch);
    });
  });

  it('should handle real user blacklist correctly (netflix.com should NOT be blocked)', () => {
    // User's actual blacklist from the bug report
    const blacklist = `www.instagram.com
x.com
imgur.com
teams.microsoft.com
meet.google.com`;

    const testCases = [
      // These should be blocked
      { url: 'https://www.instagram.com/', shouldMatch: true },
      { url: 'https://instagram.com/', shouldMatch: false }, // Now should NOT match without www
      { url: 'https://x.com/', shouldMatch: true },
      { url: 'https://www.x.com/', shouldMatch: true },
      { url: 'https://imgur.com/', shouldMatch: true },
      { url: 'https://teams.microsoft.com/', shouldMatch: true },
      { url: 'https://meet.google.com/', shouldMatch: true },

      // These should NOT be blocked
      { url: 'https://netflix.com/', shouldMatch: false }, // The main issue - should NOT match
      { url: 'https://www.netflix.com/', shouldMatch: false },
      { url: 'https://max.com/', shouldMatch: false },
      { url: 'https://fox.com/', shouldMatch: false },
      { url: 'https://google.com/', shouldMatch: false }, // Only meet.google.com should be blocked
      { url: 'https://microsoft.com/', shouldMatch: false }, // Only teams.microsoft.com should be blocked
    ];

    testCases.forEach(({ url, shouldMatch }) => {
      const result = isBlacklisted(blacklist, url);
      expect(result).toBe(shouldMatch);
    });
  });
});
