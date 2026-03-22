export async function getFromChromeSessionStorage<T extends Record<string, unknown>>(
  defaults: T
): Promise<T> {
  return chrome.storage.session.get(defaults) as Promise<T>;
}

export async function setInChromeSessionStorage<T extends Record<string, unknown>>(
  data: T
): Promise<void> {
  await chrome.storage.session.set(data);
}
