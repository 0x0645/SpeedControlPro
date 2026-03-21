import { logger } from '../utils/logger';
import { formatSpeed } from '../utils/constants';

export class ShadowDOMManager {
  static createShadowDOM(wrapper: HTMLElement, options: any = {}): ShadowRoot {
    const { top = '0px', left = '0px', speed = '1.00', opacity = 0.3, buttonSize = 14 } = options;
    const shadow = wrapper.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      * { line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 12px; box-sizing: border-box; }
      :host(:hover) #controls { display: inline-flex; }
      :host(.vsc-hidden) #controller, :host(.vsc-nosource) #controller { display: none !important; visibility: hidden !important; opacity: 0 !important; }
      :host(.vsc-manual:not(.vsc-hidden)) #controller { display: inline-flex !important; visibility: visible !important; opacity: ${opacity} !important; }
      :host(.vsc-show) #controller { display: inline-flex !important; visibility: visible !important; opacity: ${opacity} !important; }
      #controller { position: absolute; top: 0; left: 0; display: inline-flex; align-items: center; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: rgba(255, 255, 255, 0.95); border-radius: 6px; padding: 3px 4px; margin: 8px 8px 8px 12px; cursor: default; z-index: 9999999; white-space: nowrap; transition: opacity 0.15s ease; }
      #controller:hover { opacity: 0.85; }
      #controls { display: none; align-items: center; gap: 1px; margin-left: 2px; }
      #controller.dragging { cursor: -webkit-grabbing; opacity: 0.85; }
      #controller.dragging #controls { display: inline-flex; }
      .draggable { cursor: -webkit-grab; display: inline-flex; align-items: center; justify-content: center; min-width: 2.4em; height: 1.4em; text-align: center; font-weight: 600; letter-spacing: -0.01em; }
      .draggable:active { cursor: -webkit-grabbing; }
      button { cursor: pointer; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.1); font-weight: 500; border-radius: 4px; padding: 2px 6px; font-size: inherit; line-height: inherit; border: none; font-family: inherit; margin: 0; transition: background 0.12s ease, color 0.12s ease; }
      button:focus { outline: 0; }
      button:hover { background: rgba(255,255,255,0.25); color: #ffffff; }
      button:active { background: rgba(255,255,255,0.35); color: #ffffff; }
      button.rw { opacity: 0.7; }
      button.hideButton { opacity: 0.6; margin-left: 4px; font-size: 11px; }
      button.hideButton:hover { opacity: 1; }
    `;
    shadow.appendChild(style);

    const controller = document.createElement('div');
    controller.id = 'controller';
    controller.style.cssText = `top:${top}; left:${left}; opacity:${opacity};`;

    const draggable = document.createElement('span');
    draggable.setAttribute('data-action', 'drag');
    draggable.className = 'draggable';
    draggable.style.cssText = `font-size: ${buttonSize}px;`;
    draggable.textContent = speed;
    controller.appendChild(draggable);

    const controls = document.createElement('span');
    controls.id = 'controls';
    controls.style.cssText = `font-size: ${buttonSize}px; line-height: ${buttonSize}px;`;

    const buttons = [
      { action: 'rewind', text: '\u00AB', class: 'rw' },
      { action: 'slower', text: '\u2212', class: '' },
      { action: 'faster', text: '+', class: '' },
      { action: 'advance', text: '\u00BB', class: 'rw' },
      { action: 'display', text: '\u00D7', class: 'hideButton' },
    ];

    buttons.forEach((btnConfig) => {
      const button = document.createElement('button');
      button.setAttribute('data-action', btnConfig.action);
      if (btnConfig.class) {
        button.className = btnConfig.class;
      }
      button.textContent = btnConfig.text;
      controls.appendChild(button);
    });

    controller.appendChild(controls);
    shadow.appendChild(controller);
    logger.debug('Shadow DOM created for video controller');
    return shadow;
  }

  static getController(shadow: ShadowRoot): HTMLElement | null {
    return shadow.querySelector('#controller');
  }

  static getControls(shadow: ShadowRoot): HTMLElement | null {
    return shadow.querySelector('#controls');
  }

  static getSpeedIndicator(shadow: ShadowRoot): HTMLElement | null {
    return shadow.querySelector('.draggable');
  }

  static getButtons(shadow: ShadowRoot): NodeListOf<HTMLButtonElement> {
    return shadow.querySelectorAll('button');
  }

  static updateSpeedDisplay(shadow: ShadowRoot, speed: number): void {
    const speedIndicator = this.getSpeedIndicator(shadow);
    if (speedIndicator) {
      speedIndicator.textContent = formatSpeed(speed);
    }
  }

  static calculatePosition(video: HTMLMediaElement): { top: string; left: string } {
    const rect = video.getBoundingClientRect();
    const offsetRect = (video.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const top = `${Math.max(rect.top - (offsetRect?.top || 0), 0)}px`;
    const left = `${Math.max(rect.left - (offsetRect?.left || 0), 0)}px`;
    return { top, left };
  }
}
