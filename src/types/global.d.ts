import type { VideoSpeedExtension } from '../content/inject';
import type { StorageSnapshot } from './contracts';

interface VscWindowNamespace {
  VideoSpeedExtension?: typeof VideoSpeedExtension;
  [key: string]: unknown;
}

declare global {
  // Chrome extension APIs
  // eslint-disable-next-line no-var
  var chrome: typeof globalThis.chrome;

  interface Window {
    VSC: VscWindowNamespace;
    /** Page-level settings cache used by StorageManager in inject context */
    VSC_settings: StorageSnapshot | null;
    validationTimeout?: ReturnType<typeof setTimeout>;
    /** The active VideoSpeedExtension instance */
    VSC_controller: VideoSpeedExtension | null;
  }
}

export {};
