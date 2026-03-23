export interface MockVideoOptions {
  playbackRate?: number;
  currentTime?: number;
  duration?: number;
  currentSrc?: string;
  paused?: boolean;
  muted?: boolean;
  volume?: number;
}

export interface MockAudioOptions {
  playbackRate?: number;
  currentTime?: number;
  duration?: number;
  currentSrc?: string;
  paused?: boolean;
  muted?: boolean;
  volume?: number;
}

export interface MockDOM {
  container: HTMLDivElement;
  cleanup: () => void;
}

export function createMockVideo(options: MockVideoOptions = {}): HTMLVideoElement {
  const video = document.createElement('video');

  Object.defineProperties(video, {
    playbackRate: {
      value: options.playbackRate ?? 1.0,
      writable: true,
      configurable: true,
    },
    currentTime: {
      value: options.currentTime ?? 0,
      writable: true,
      configurable: true,
    },
    duration: {
      value: options.duration ?? 100,
      writable: true,
      configurable: true,
    },
    currentSrc: {
      value:
        options.currentSrc !== undefined ? options.currentSrc : 'https://example.com/video.mp4',
      writable: true,
      configurable: true,
    },
    paused: {
      value: options.paused ?? false,
      writable: true,
      configurable: true,
    },
    muted: {
      value: options.muted ?? false,
      writable: true,
      configurable: true,
    },
    volume: {
      value: options.volume ?? 1.0,
      writable: true,
      configurable: true,
    },
    ownerDocument: {
      value: document,
      writable: true,
      configurable: true,
    },
  });

  const mutable = video as HTMLVideoElement & { paused: boolean };
  video.play = () => {
    mutable.paused = false;
    return Promise.resolve();
  };

  video.pause = () => {
    mutable.paused = true;
  };

  video.getBoundingClientRect = () => new DOMRect(0, 0, 640, 480);

  const eventListeners = new Map<string, ((e: Event) => void)[]>();
  video.addEventListener = (type: string, listener: (e: Event) => void) => {
    if (!eventListeners.has(type)) {
      eventListeners.set(type, []);
    }
    eventListeners.get(type)!.push(listener);
  };

  video.removeEventListener = (type: string, listener: (e: Event) => void) => {
    if (eventListeners.has(type)) {
      const listeners = eventListeners.get(type)!;
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  };

  video.dispatchEvent = (event: Event) => {
    if (eventListeners.has(event.type)) {
      (event as { target?: EventTarget }).target = video;
      eventListeners.get(event.type)!.forEach((listener) => listener(event));
    }
    return true;
  };

  video.matches = () => false;
  video.querySelector = () => null;
  video.querySelectorAll = () => document.createElement('div').querySelectorAll('*');

  return video;
}

export function createMockAudio(options: MockAudioOptions = {}): HTMLAudioElement {
  const audio = document.createElement('audio');
  const mutable = audio as HTMLAudioElement & {
    playbackRate: number;
    currentTime: number;
    duration: number;
    currentSrc: string;
    paused: boolean;
    muted: boolean;
    volume: number;
  };

  mutable.playbackRate = options.playbackRate ?? 1.0;
  mutable.currentTime = options.currentTime ?? 0;
  mutable.duration = options.duration ?? 100;
  mutable.currentSrc = options.currentSrc ?? 'https://example.com/audio.mp3';
  mutable.paused = options.paused ?? false;
  mutable.muted = options.muted ?? false;
  mutable.volume = options.volume ?? 1.0;

  audio.play = () => {
    mutable.paused = false;
    return Promise.resolve();
  };

  audio.pause = () => {
    mutable.paused = true;
  };

  return audio;
}

export function createMockDOM(): MockDOM {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);

  return {
    container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockEvent(type: string, properties: Record<string, unknown> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
}

export function createMockKeyboardEvent(
  type: string,
  keyCode: number,
  options: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    keyCode,
    ...options,
  });

  Object.defineProperty(event, 'keyCode', { value: keyCode });

  return event;
}
