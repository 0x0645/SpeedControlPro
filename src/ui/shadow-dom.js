/**
 * Shadow DOM creation and management
 */

window.VSC = window.VSC || {};

class ShadowDOMManager {
  /**
   * Create shadow DOM for video controller
   * @param {HTMLElement} wrapper - Wrapper element
   * @param {Object} options - Configuration options
   * @returns {ShadowRoot} Created shadow root
   */
  static createShadowDOM(wrapper, options = {}) {
    const { top = '0px', left = '0px', speed = '1.00', opacity = 0.3, buttonSize = 14 } = options;

    const shadow = wrapper.attachShadow({ mode: 'open' });

    // Create style element with embedded CSS for immediate styling
    const style = document.createElement('style');
    style.textContent = `
      * {
        line-height: 1.6;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        box-sizing: border-box;
      }

      :host(:hover) #controls {
        display: inline-flex;
      }

      :host(.vsc-hidden) #controller,
      :host(.vsc-nosource) #controller {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }

      :host(.vsc-manual:not(.vsc-hidden)) #controller {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: ${opacity} !important;
      }

      :host(.vsc-show) #controller {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: ${opacity} !important;
      }

      #controller {
        position: absolute;
        top: 0;
        left: 0;
        display: inline-flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: rgba(255, 255, 255, 0.95);
        border-radius: 6px;
        padding: 3px 4px;
        margin: 8px 8px 8px 12px;
        cursor: default;
        z-index: 9999999;
        white-space: nowrap;
        transition: opacity 0.15s ease;
      }

      #controller:hover {
        opacity: 0.85;
      }

      #controls {
        display: none;
        align-items: center;
        gap: 1px;
        margin-left: 2px;
      }

      #controller.dragging {
        cursor: -webkit-grabbing;
        opacity: 0.85;
      }

      #controller.dragging #controls {
        display: inline-flex;
      }

      .draggable {
        cursor: -webkit-grab;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.4em;
        height: 1.4em;
        text-align: center;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .draggable:active {
        cursor: -webkit-grabbing;
      }

      button {
        cursor: pointer;
        color: rgba(255, 255, 255, 0.85);
        background: rgba(255, 255, 255, 0.1);
        font-weight: 500;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: inherit;
        line-height: inherit;
        border: none;
        font-family: inherit;
        margin: 0;
        transition: background 0.12s ease, color 0.12s ease;
      }

      button:focus {
        outline: 0;
      }

      button:hover {
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
      }

      button:active {
        background: rgba(255, 255, 255, 0.35);
        color: #ffffff;
      }

      button.rw {
        opacity: 0.7;
      }

      button.hideButton {
        opacity: 0.6;
        margin-left: 4px;
        font-size: 11px;
      }

      button.hideButton:hover {
        opacity: 1;
      }
    `;
    shadow.appendChild(style);

    // Create controller div
    const controller = document.createElement('div');
    controller.id = 'controller';
    controller.style.cssText = `top:${top}; left:${left}; opacity:${opacity};`;

    // Create draggable speed indicator
    const draggable = document.createElement('span');
    draggable.setAttribute('data-action', 'drag');
    draggable.className = 'draggable';
    draggable.style.cssText = `font-size: ${buttonSize}px;`;
    draggable.textContent = speed;
    controller.appendChild(draggable);

    // Create controls span
    const controls = document.createElement('span');
    controls.id = 'controls';
    controls.style.cssText = `font-size: ${buttonSize}px; line-height: ${buttonSize}px;`;

    // Create buttons
    const buttons = [
      { action: 'rewind', text: '«', class: 'rw' },
      { action: 'slower', text: '−', class: '' },
      { action: 'faster', text: '+', class: '' },
      { action: 'advance', text: '»', class: 'rw' },
      { action: 'display', text: '×', class: 'hideButton' },
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

    window.VSC.logger.debug('Shadow DOM created for video controller');
    return shadow;
  }

  /**
   * Get controller element from shadow DOM
   * @param {ShadowRoot} shadow - Shadow root
   * @returns {HTMLElement} Controller element
   */
  static getController(shadow) {
    return shadow.querySelector('#controller');
  }

  /**
   * Get controls container from shadow DOM
   * @param {ShadowRoot} shadow - Shadow root
   * @returns {HTMLElement} Controls element
   */
  static getControls(shadow) {
    return shadow.querySelector('#controls');
  }

  /**
   * Get draggable speed indicator from shadow DOM
   * @param {ShadowRoot} shadow - Shadow root
   * @returns {HTMLElement} Speed indicator element
   */
  static getSpeedIndicator(shadow) {
    return shadow.querySelector('.draggable');
  }

  /**
   * Get all buttons from shadow DOM
   * @param {ShadowRoot} shadow - Shadow root
   * @returns {NodeList} Button elements
   */
  static getButtons(shadow) {
    return shadow.querySelectorAll('button');
  }

  /**
   * Update speed display in shadow DOM
   * @param {ShadowRoot} shadow - Shadow root
   * @param {number} speed - New speed value
   */
  static updateSpeedDisplay(shadow, speed) {
    const speedIndicator = this.getSpeedIndicator(shadow);
    if (speedIndicator) {
      speedIndicator.textContent = window.VSC.Constants.formatSpeed(speed);
    }
  }

  /**
   * Calculate position for controller based on video element
   * @param {HTMLVideoElement} video - Video element
   * @returns {Object} Position object with top and left properties
   */
  static calculatePosition(video) {
    const rect = video.getBoundingClientRect();

    // getBoundingClientRect is relative to the viewport; style coordinates
    // are relative to offsetParent, so we adjust for that here. offsetParent
    // can be null if the video has `display: none` or is not yet in the DOM.
    const offsetRect = video.offsetParent?.getBoundingClientRect();
    const top = `${Math.max(rect.top - (offsetRect?.top || 0), 0)}px`;
    const left = `${Math.max(rect.left - (offsetRect?.left || 0), 0)}px`;

    return { top, left };
  }
}

// Create singleton instance
window.VSC.ShadowDOMManager = ShadowDOMManager;
