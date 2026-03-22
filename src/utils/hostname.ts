/**
 * Normalizes a hostname for consistent profile matching.
 * Strips protocol, path, www. prefix, and lowercases.
 * Returns null if the input is not a valid hostname.
 */
export function normalizeHostname(input: string): string | null {
  let hostname = input
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase();

  // Strip www. prefix for consistent matching
  hostname = hostname.replace(/^www\./, '');

  if (!hostname || hostname.includes(' ')) {
    return null;
  }

  // Basic format check: only valid hostname characters (allows single-label like "localhost")
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(hostname)) {
    return null;
  }

  return hostname;
}
