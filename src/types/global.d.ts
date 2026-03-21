import type { VideoSpeedExtension } from '../content/inject';

declare global {
  // Chrome extension APIs
  // eslint-disable-next-line no-var
  var chrome: typeof globalThis.chrome;

  interface Window {
    VSC: Record<string, unknown> & {
      VideoSpeedExtension?: typeof VideoSpeedExtension;
    };
    /** Page-level settings cache used by StorageManager in inject context */
    VSC_settings: Record<string, unknown> | null;
    validationTimeout?: ReturnType<typeof setTimeout>;
    /** The active VideoSpeedExtension instance */
    VSC_controller: VideoSpeedExtension | null;
  }
}

export {};
