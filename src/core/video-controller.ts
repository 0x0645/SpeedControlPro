import { ControlsManager } from '../ui/controls';
import { ShadowDOMManager } from '../ui/shadow-dom';
import { stateManager } from './state-manager';
import { logger } from '../utils/logger';
import { formatSpeed } from '../utils/constants';
import { siteHandlerManager } from '../site-handlers/index';
import type { VscMedia, IVideoSpeedConfig, IActionHandler } from '../types/settings';

export class VideoController {
  video!: VscMedia;
  parent!: HTMLElement | null;
  config!: IVideoSpeedConfig;
  actionHandler!: IActionHandler;
  controlsManager!: ControlsManager;
  shouldStartHidden!: boolean;
  controllerId!: string;
  speedBeforeReset!: number | null;
  div!: HTMLElement;
  speedIndicator!: { textContent: string } | null;
  handlePlay?: EventListener;
  handleSeek?: EventListener;
  targetObserver?: MutationObserver;

  constructor(
    target: VscMedia,
    parent: HTMLElement | null,
    config: IVideoSpeedConfig,
    actionHandler: IActionHandler,
    shouldStartHidden = false
  ) {
    if (target.vsc) {
      return target.vsc as unknown as VideoController;
    }

    this.video = target;
    this.parent = target.parentElement || parent;
    this.config = config;
    this.actionHandler = actionHandler;
    this.controlsManager = new ControlsManager(actionHandler, config);
    this.shouldStartHidden = shouldStartHidden;
    this.controllerId = this.generateControllerId(target);
    this.speedBeforeReset = null;

    target.vsc = this as unknown as import('../types/settings').VscAttachment;

    if (stateManager) {
      stateManager.registerController(this);
    } else {
      logger.error('StateManager not available during VideoController initialization');
    }

    this.initializeSpeed();
    this.div = this.initializeControls();
    this.setupEventHandlers();
    this.setupMutationObserver();

    logger.info('VideoController initialized for video element');
  }

  initializeSpeed(): void {
    const targetSpeed = this.getTargetSpeed();
    logger.debug(`Setting initial playbackRate to: ${targetSpeed}`);

    if (this.actionHandler && targetSpeed !== this.video.playbackRate) {
      logger.debug('Setting initial speed via adjustSpeed');
      this.actionHandler.adjustSpeed(this.video, targetSpeed, { source: 'internal' });
    }
  }

  getTargetSpeed(media: HTMLMediaElement = this.video): number {
    const hostname = location.hostname;
    const speed = (this.config.getEffectiveSetting('speed', hostname) as number) || 1.0;
    logger.debug(`Target speed for ${hostname}: ${speed}`);
    return speed;
  }

  initializeControls(): HTMLElement {
    logger.debug('initializeControls Begin');

    const document = this.video.ownerDocument;
    const speed = formatSpeed(this.video.playbackRate);
    const position = ShadowDOMManager.calculatePosition(this.video);
    const hostname = location.hostname;

    const wrapper = document.createElement('vsc-controller');
    const cssClasses = ['vsc-controller'];

    if (!this.video.currentSrc && !this.video.src && this.video.readyState < 2) {
      cssClasses.push('vsc-nosource');
    }

    const startHidden = this.config.getEffectiveSetting('startHidden', hostname);
    if (startHidden || this.shouldStartHidden) {
      cssClasses.push('vsc-hidden');
      logger.debug('Starting controller hidden');
    }

    wrapper.className = cssClasses.join(' ');
    wrapper.style.cssText = `
      position: absolute !important;
      z-index: 9999999 !important;
      top: ${position.top};
      left: ${position.left};
    `;

    const shadow = ShadowDOMManager.createShadowDOM(wrapper, {
      top: '0px',
      left: '0px',
      speed,
      opacity: this.config.getEffectiveSetting('controllerOpacity', hostname) as number | undefined,
      buttonSize: this.config.getEffectiveSetting('controllerButtonSize', hostname) as
        | number
        | undefined,
    });

    this.controlsManager.setupControlEvents(shadow, this.video);
    this.speedIndicator = ShadowDOMManager.getSpeedIndicator(shadow);
    this.insertIntoDOM(document, wrapper);

    logger.debug('initializeControls End');
    return wrapper;
  }

  insertIntoDOM(document: Document, wrapper: HTMLElement): void {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(wrapper);

    const positioning = siteHandlerManager.getControllerPosition(this.parent!, this.video);

    const point = positioning.insertionPoint;
    if (!point) {
      return;
    }

    switch (positioning.insertionMethod) {
      case 'beforeParent':
        point.parentElement?.insertBefore(fragment, point);
        break;
      case 'afterParent':
        point.parentElement?.insertBefore(fragment, point.nextSibling);
        break;
      case 'firstChild':
      default:
        point.insertBefore(fragment, point.firstChild);
        break;
    }

    logger.debug(`Controller inserted using ${positioning.insertionMethod} method`);
  }

  setupEventHandlers(): void {
    const mediaEventAction = (event: Event) => {
      const media = event.target as HTMLMediaElement;
      const targetSpeed = this.getTargetSpeed(media);

      logger.info(`Media event ${event.type}: restoring speed to ${targetSpeed}`);
      this.actionHandler.adjustSpeed(media, targetSpeed, { source: 'internal' });
    };

    this.handlePlay = mediaEventAction.bind(this);
    this.handleSeek = mediaEventAction.bind(this);

    this.video.addEventListener('play', this.handlePlay);
    this.video.addEventListener('seeked', this.handleSeek);

    logger.debug('Added essential media event handlers: play, seeked');
  }

  setupMutationObserver(): void {
    this.targetObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const media = mutation.target as HTMLMediaElement;
        if (
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'src' || mutation.attributeName === 'currentSrc')
        ) {
          logger.debug('Mutation of A/V element detected');
          const controller = this.div;
          if (!media.src && !media.currentSrc) {
            controller.classList.add('vsc-nosource');
          } else {
            controller.classList.remove('vsc-nosource');
          }
        }
      });
    });

    this.targetObserver.observe(this.video, {
      attributeFilter: ['src', 'currentSrc'],
    });
  }

  remove(): void {
    logger.debug('Removing VideoController');

    if (this.div && this.div.parentNode) {
      this.div.remove();
    }

    if (this.handlePlay) {
      this.video.removeEventListener('play', this.handlePlay);
    }
    if (this.handleSeek) {
      this.video.removeEventListener('seeked', this.handleSeek);
    }

    if (this.targetObserver) {
      this.targetObserver.disconnect();
    }

    if (stateManager) {
      stateManager.removeController(this.controllerId);
    }

    delete this.video.vsc;

    logger.debug('VideoController removed successfully');
  }

  generateControllerId(
    target: HTMLElement & { currentSrc?: string; src?: string; tagName: string }
  ): string {
    const timestamp = Date.now();
    const src = target.currentSrc || target.src || 'no-src';
    const tagName = target.tagName.toLowerCase();
    const srcHash = src.split('').reduce((hash, char) => {
      hash = (hash << 5) - hash + char.charCodeAt(0);
      return hash & hash;
    }, 0);

    const random = Math.floor(Math.random() * 1000);
    return `${tagName}-${Math.abs(srcHash)}-${timestamp}-${random}`;
  }

  isVideoVisible(): boolean {
    if (!this.video.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(this.video);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = this.video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    return true;
  }

  updateVisibility(): void {
    const isVisible = this.isVideoVisible();
    const isCurrentlyHidden = this.div.classList.contains('vsc-hidden');

    const hostname = location.hostname;
    const audioBoolean = this.config.getEffectiveSetting('audioBoolean', hostname);
    const effectiveStartHidden = this.config.getEffectiveSetting('startHidden', hostname);

    if (this.video.tagName === 'AUDIO') {
      if (!audioBoolean && !isCurrentlyHidden) {
        this.div.classList.add('vsc-hidden');
        logger.debug('Hiding audio controller - audio support disabled');
      } else if (audioBoolean && isCurrentlyHidden && !this.div.classList.contains('vsc-manual')) {
        this.div.classList.remove('vsc-hidden');
        logger.debug('Showing audio controller - audio support enabled');
      }
      return;
    }

    if (
      isVisible &&
      isCurrentlyHidden &&
      !this.div.classList.contains('vsc-manual') &&
      !effectiveStartHidden
    ) {
      this.div.classList.remove('vsc-hidden');
      logger.debug('Showing controller - video became visible');
    } else if (!isVisible && !isCurrentlyHidden) {
      this.div.classList.add('vsc-hidden');
      logger.debug('Hiding controller - video became invisible');
    }
  }
}
