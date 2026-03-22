export type ChromeTabLike = {
  id?: number;
  url?: string;
};

export async function queryActiveTab<T extends ChromeTabLike = ChromeTabLike>(): Promise<T | null> {
  const tabs = (await chrome.tabs.query({ active: true, currentWindow: true })) as T[];
  return tabs[0] || null;
}

export async function sendTabMessage<T>(tabId: number, message: object): Promise<T | undefined> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T | undefined>;
}

export async function sendRuntimeMessage(message: object): Promise<void> {
  await chrome.runtime.sendMessage(message);
}

export async function openOptionsPage(): Promise<void> {
  await chrome.runtime.openOptionsPage();
}
