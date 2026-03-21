window.VSC = window.VSC || {};

class VSCControllerElement extends HTMLElement {
  connectedCallback(): void {
    window.VSC.logger?.debug('VSC custom element connected to DOM');
  }

  disconnectedCallback(): void {
    window.VSC.logger?.debug('VSC custom element disconnected from DOM');
  }

  static register(): void {
    if (!customElements.get('vsc-controller')) {
      customElements.define('vsc-controller', VSCControllerElement);
      window.VSC.logger?.info('VSC custom element registered');
    }
  }
}

window.VSC.VSCControllerElement = VSCControllerElement;
VSCControllerElement.register();
