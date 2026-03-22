import { inIframe } from './dom-utils';
import { logger } from './logger';
import { stateManager } from '../core/state-manager';
import { SPEED_LIMITS } from './constants';
import type { IVideoSpeedConfig, IActionHandler, KeyBinding, VscMedia } from '../types/settings';

type ManagedListener = {
  type: string;
  handler: EventListener;
  useCapture: boolean;
};

export class EventManager {
  static COOLDOWN_MS = 200;

  config: IVideoSpeedConfig;
  actionHandler: IActionHandler | null;
  listeners: Map<Document, ManagedListener[]>;
  coolDown: ReturnType<typeof setTimeout> | false;
  timer: ReturnType<typeof setTimeout> | null;
  lastKeyEventSignature: string | null;

  constructor(config: IVideoSpeedConfig, actionHandler: IActionHandler | null) {
    this.config = config;
    this.actionHandler = actionHandler;
    this.listeners = new Map();
    this.coolDown = false;
    this.timer = null;
    this.lastKeyEventSignature = null;
  }

  setupEventListeners(document: Document): void {
    this.setupKeyboardShortcuts(document);
    this.setupRateChangeListener(document);
  }

  setupKeyboardShortcuts(document: Document): void {
    const docs = [document];

    try {
      if (inIframe()) {
        if (window.top?.document) {
          docs.push(window.top.document);
        }
      }
    } catch {
      // ignore cross-origin access
    }

    docs.forEach((doc) => {
      const keydownHandler = (event: Event) => this.handleKeydown(event as KeyboardEvent);
      doc.addEventListener('keydown', keydownHandler, true);

      if (!this.listeners.has(doc)) {
        this.listeners.set(doc, []);
      }
      this.listeners.get(doc)!.push({
        type: 'keydown',
        handler: keydownHandler,
        useCapture: true,
      });
    });
  }

  handleKeydown(event: KeyboardEvent): boolean {
    const keyCode = event.keyCode;
    logger.verbose(`Processing keydown event: key=${event.key}, keyCode=${keyCode}`);

    const eventSignature = `${keyCode}_${event.timeStamp}_${event.type}`;
    if (this.lastKeyEventSignature === eventSignature) {
      return false;
    }

    this.lastKeyEventSignature = eventSignature;

    if (this.hasActiveModifier(event)) {
      logger.debug(`Keydown event ignored due to active modifier: ${keyCode}`);
      return false;
    }

    if (this.isTypingContext(event.target as Element)) {
      return false;
    }

    const mediaElements = stateManager ? stateManager.getControlledElements() : [];
    if (!mediaElements.length) {
      return false;
    }

    const effectiveKeyBindings = this.config.getEffectiveSetting(
      'keyBindings',
      location.hostname
    ) as KeyBinding[] | null;
    const keyBinding = effectiveKeyBindings?.find((item: KeyBinding) => item.key === keyCode);

    if (keyBinding) {
      this.actionHandler?.runAction(keyBinding.action, keyBinding.value, event);

      if (keyBinding.force === true || keyBinding.force === 'true') {
        event.preventDefault();
        event.stopPropagation();
      }
    } else {
      logger.verbose(`No key binding found for keyCode: ${keyCode}`);
    }

    return false;
  }

  hasActiveModifier(event: KeyboardEvent): boolean {
    return (
      !event.getModifierState ||
      event.getModifierState('Alt') ||
      event.getModifierState('Control') ||
      event.getModifierState('Fn') ||
      event.getModifierState('Meta') ||
      event.getModifierState('Hyper') ||
      event.getModifierState('OS')
    );
  }

  isTypingContext(target: Element | null): boolean {
    if (!target) {
      return false;
    }

    return (
      target.nodeName === 'INPUT' ||
      target.nodeName === 'TEXTAREA' ||
      (target as HTMLElement).isContentEditable
    );
  }

  setupRateChangeListener(document: Document): void {
    const rateChangeHandler = (event: Event) => this.handleRateChange(event);
    document.addEventListener('ratechange', rateChangeHandler, true);

    if (!this.listeners.has(document)) {
      this.listeners.set(document, []);
    }
    this.listeners.get(document)!.push({
      type: 'ratechange',
      handler: rateChangeHandler,
      useCapture: true,
    });
  }

  handleRateChange(event: Event): void {
    if (this.coolDown) {
      logger.debug('Rate change event blocked by cooldown');

      const video = (event.composedPath ? event.composedPath()[0] : event.target) as VscMedia;
      if (video.vsc && this.config.settings.lastSpeed !== undefined) {
        const authoritativeSpeed = this.config.settings.lastSpeed;
        if (Math.abs(video.playbackRate - authoritativeSpeed) > 0.01) {
          logger.info(
            `Restoring speed during cooldown from external ${video.playbackRate} to authoritative ${authoritativeSpeed}`
          );
          video.playbackRate = authoritativeSpeed;
        }
      }

      event.stopImmediatePropagation();
      return;
    }

    const video = (event.composedPath ? event.composedPath()[0] : event.target) as VscMedia;
    if (!video.vsc) {
      logger.debug('Skipping ratechange - no VSC controller attached');
      return;
    }

    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.origin === 'videoSpeed') {
      logger.debug('Ignoring extension-originated rate change');
      return;
    }

    if (this.config.settings.forceLastSavedSpeed) {
      if (customEvent.detail && customEvent.detail.origin === 'videoSpeed') {
        video.playbackRate = Number(customEvent.detail.speed);
      } else {
        const authoritativeSpeed = this.config.settings.lastSpeed || 1.0;
        logger.info(
          `Force mode: restoring external ${video.playbackRate} to authoritative ${authoritativeSpeed}`
        );
        video.playbackRate = authoritativeSpeed;
      }
      event.stopImmediatePropagation();
      return;
    }

    if (video.readyState < 1) {
      logger.debug('Ignoring external ratechange during video initialization (readyState < 1)');
      event.stopImmediatePropagation();
      return;
    }

    const rawExternalRate = typeof video.playbackRate === 'number' ? video.playbackRate : NaN;
    const min = SPEED_LIMITS.MIN;
    if (!isNaN(rawExternalRate) && rawExternalRate <= min) {
      logger.debug(`Ignoring external ratechange below MIN: raw=${rawExternalRate}, MIN=${min}`);
      event.stopImmediatePropagation();
      return;
    }

    if (this.actionHandler) {
      this.actionHandler.adjustSpeed(video, video.playbackRate, {
        source: 'external',
      });
    }

    event.stopImmediatePropagation();
  }

  refreshCoolDown(): void {
    logger.debug('Begin refreshCoolDown');

    if (this.coolDown) {
      globalThis.clearTimeout(this.coolDown);
    }

    this.coolDown = globalThis.setTimeout(() => {
      this.coolDown = false;
    }, EventManager.COOLDOWN_MS);

    logger.debug('End refreshCoolDown');
  }

  showController(controller: Element): void {
    const effectiveStartHidden = this.config.getEffectiveSetting('startHidden', location.hostname);
    if (effectiveStartHidden && !controller.classList.contains('vsc-manual')) {
      logger.info(
        `Controller respecting startHidden setting - no temporary display (startHidden: ${effectiveStartHidden}, manual: ${controller.classList.contains('vsc-manual')})`
      );
      return;
    }

    logger.info(
      `Showing controller temporarily (startHidden: ${effectiveStartHidden}, manual: ${controller.classList.contains('vsc-manual')})`
    );
    controller.classList.add('vsc-show');

    if (this.timer) {
      globalThis.clearTimeout(this.timer);
    }

    this.timer = globalThis.setTimeout(() => {
      controller.classList.remove('vsc-show');
      this.timer = null;
      logger.debug('Hiding controller');
    }, 2000);
  }

  cleanup(): void {
    this.listeners.forEach((eventList, doc) => {
      eventList.forEach(({ type, handler, useCapture }) => {
        try {
          doc.removeEventListener(type, handler, useCapture);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to remove event listener: ${message}`);
        }
      });
    });

    this.listeners.clear();

    if (this.coolDown) {
      globalThis.clearTimeout(this.coolDown);
      this.coolDown = false;
    }

    if (this.timer) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
