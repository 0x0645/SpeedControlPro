import { LOG_LEVELS } from './constants';

export class Logger {
  verbosity: number;
  defaultLevel: number;
  contextStack: string[];

  constructor() {
    this.verbosity = 3;
    this.defaultLevel = 4;
    this.contextStack = [];
  }

  setVerbosity(level: number): void {
    this.verbosity = level;
  }

  setDefaultLevel(level: number): void {
    this.defaultLevel = level;
  }

  generateContext(): string {
    if (this.contextStack.length > 0) {
      return `[${this.contextStack[this.contextStack.length - 1]}] `;
    }
    return '';
  }

  formatVideoId(video: HTMLMediaElement & { vsc?: { controllerId?: string } }): string {
    if (!video) {
      return 'V?';
    }

    const isAudio = video.tagName === 'AUDIO';
    const prefix = isAudio ? 'A' : 'V';

    if (video.vsc?.controllerId) {
      return `${prefix}${video.vsc.controllerId}`;
    }

    return `${prefix}?`;
  }

  pushContext(context: string | HTMLMediaElement): void {
    if (typeof context === 'string') {
      this.contextStack.push(context);
    } else if (context && (context.tagName === 'VIDEO' || context.tagName === 'AUDIO')) {
      this.contextStack.push(this.formatVideoId(context as HTMLMediaElement & { vsc?: { controllerId?: string } }));
    }
  }

  popContext(): void {
    this.contextStack.pop();
  }

  withContext<T>(context: string | HTMLMediaElement, fn: () => T): T {
    this.pushContext(context);
    try {
      return fn();
    } finally {
      this.popContext();
    }
  }

  log(message: string, level?: number): void {
    const logLevel = typeof level === 'undefined' ? this.defaultLevel : level;

    if (this.verbosity >= logLevel) {
      const context = this.generateContext();
      const contextualMessage = `${context}${message}`;

      switch (logLevel) {
        case LOG_LEVELS.ERROR:
          console.log(`ERROR:${contextualMessage}`);
          break;
        case LOG_LEVELS.WARNING:
          console.log(`WARNING:${contextualMessage}`);
          break;
        case LOG_LEVELS.INFO:
          console.log(`INFO:${contextualMessage}`);
          break;
        case LOG_LEVELS.DEBUG:
          console.log(`DEBUG:${contextualMessage}`);
          break;
        case LOG_LEVELS.VERBOSE:
          console.log(`DEBUG (VERBOSE):${contextualMessage}`);
          console.trace();
          break;
        default:
          console.log(contextualMessage);
      }
    }
  }

  error(message: string): void {
    this.log(message, LOG_LEVELS.ERROR);
  }

  warn(message: string): void {
    this.log(message, LOG_LEVELS.WARNING);
  }

  info(message: string): void {
    this.log(message, LOG_LEVELS.INFO);
  }

  debug(message: string): void {
    this.log(message, LOG_LEVELS.DEBUG);
  }

  verbose(message: string): void {
    this.log(message, LOG_LEVELS.VERBOSE);
  }
}

export const logger = new Logger();
