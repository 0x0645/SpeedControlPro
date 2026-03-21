declare global {
  // Chrome extension APIs
  var chrome: typeof globalThis.chrome;

  interface Window {
    /** Page-level settings cache used by StorageManager in inject context */
    VSC_settings: Record<string, unknown> | null;
    /** The active VideoSpeedExtension instance */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    VSC_controller: any;
  }
}

export {};
