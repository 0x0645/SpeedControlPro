import { logger } from '../utils/logger';

export class VSCControllerElement extends HTMLElement {
  connectedCallback(): void {
    logger?.debug('VSC custom element connected to DOM');
  }

  disconnectedCallback(): void {
    logger?.debug('VSC custom element disconnected from DOM');
  }

  static register(): void {
    if (!customElements.get('vsc-controller')) {
      customElements.define('vsc-controller', VSCControllerElement);
      logger?.info('VSC custom element registered');
    }
  }
}

VSCControllerElement.register();
