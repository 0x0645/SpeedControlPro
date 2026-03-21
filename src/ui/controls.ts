import { logger } from '../utils/logger';
import type { IActionHandler, IVideoSpeedConfig } from '../types/settings';

export class ControlsManager {
  actionHandler: IActionHandler;
  config: IVideoSpeedConfig;

  constructor(actionHandler: IActionHandler, config: IVideoSpeedConfig) {
    this.actionHandler = actionHandler;
    this.config = config;
  }

  setupControlEvents(shadow: ShadowRoot, video: HTMLMediaElement): void {
    this.setupDragHandler(shadow);
    this.setupButtonHandlers(shadow);
    this.setupWheelHandler(shadow, video);
    this.setupClickPrevention(shadow);
  }

  setupDragHandler(shadow: ShadowRoot): void {
    const draggable = shadow.querySelector('.draggable') as HTMLElement;
    draggable.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        this.actionHandler.runAction(target.dataset['action'] ?? '', false, e);
        e.stopPropagation();
        e.preventDefault();
      },
      true
    );
  }

  setupButtonHandlers(shadow: ShadowRoot): void {
    shadow.querySelectorAll('button').forEach((button) => {
      button.addEventListener(
        'click',
        (e: Event) => {
          const target = e.target as HTMLElement;
          this.actionHandler.runAction(
            target.dataset['action'] ?? '',
            this.config.getKeyBinding(target.dataset['action'] ?? ''),
            e
          );
          e.stopPropagation();
        },
        true
      );

      button.addEventListener(
        'touchstart',
        (e: Event) => {
          e.stopPropagation();
        },
        true
      );
    });
  }

  setupWheelHandler(shadow: ShadowRoot, video: HTMLMediaElement): void {
    const controller = shadow.querySelector('#controller') as HTMLElement;

    controller.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        if (event.deltaMode === event.DOM_DELTA_PIXEL) {
          const TOUCHPAD_THRESHOLD = 50;
          if (Math.abs(event.deltaY) < TOUCHPAD_THRESHOLD) {
            logger.debug(
              `Touchpad scroll detected (deltaY: ${event.deltaY}) - ignoring`
            );
            return;
          }
        }

        event.preventDefault();

        const delta = Math.sign(event.deltaY);
        const step = 0.1;
        const speedDelta = delta < 0 ? step : -step;
        this.actionHandler.adjustSpeed(video, speedDelta, { relative: true });

        logger.debug(
          `Wheel control: adjusting speed by ${speedDelta} (deltaMode: ${event.deltaMode}, deltaY: ${event.deltaY})`
        );
      },
      { passive: false }
    );
  }

  setupClickPrevention(shadow: ShadowRoot): void {
    const controller = shadow.querySelector('#controller') as HTMLElement;
    controller.addEventListener('click', (e: Event) => e.stopPropagation(), false);
    controller.addEventListener('mousedown', (e: Event) => e.stopPropagation(), false);
  }
}
