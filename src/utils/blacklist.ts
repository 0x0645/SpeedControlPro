export function isBlacklisted(blacklist: string, href: string): boolean {
  if (!blacklist) {
    return false;
  }

  const regStrip = /^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;
  const regEndsWithFlags = /\/(?!.*(.).*\1)[gimsuy]*$/;
  const escapeRegExp = (str: string) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

  for (const rawMatch of blacklist.split('\n')) {
    const match = rawMatch.replace(regStrip, '');
    if (match.length === 0) {
      continue;
    }

    let regexp: RegExp;
    if (match.startsWith('/')) {
      try {
        const parts = match.split('/');
        if (parts.length < 3) {
          continue;
        }

        const hasFlags = regEndsWithFlags.test(match);
        const flags = hasFlags ? parts.pop() || '' : '';
        const regex = parts.slice(1, hasFlags ? undefined : -1).join('/');

        if (!regex) {
          continue;
        }
        regexp = new RegExp(regex, flags);
      } catch {
        continue;
      }
    } else {
      const escapedMatch = escapeRegExp(match);
      const looksLikeDomain = match.includes('.') && !match.includes('/');
      regexp = looksLikeDomain
        ? new RegExp(`(^|\\.|//)${escapedMatch}(\\/|:|$)`)
        : new RegExp(escapedMatch);
    }

    if (regexp.test(href)) {
      return true;
    }
  }

  return false;
}
