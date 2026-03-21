window.VSC = window.VSC || {};
window.VSC.DomUtils = {};

window.VSC.DomUtils.inIframe = function (): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

window.VSC.DomUtils.getShadow = function (parent: Element | ShadowRoot, maxDepth = 10): Element[] {
  const result: Element[] = [];
  const visited = new WeakSet<Element | ShadowRoot>();

  function getChild(element: Element | ShadowRoot, depth = 0): void {
    if (depth > maxDepth || visited.has(element)) {
      return;
    }

    visited.add(element);

    if ('firstElementChild' in element && element.firstElementChild) {
      let child: Element | null = element.firstElementChild;
      do {
        result.push(child);
        getChild(child, depth + 1);

        const childWithShadow = child as Element & { shadowRoot?: ShadowRoot | null };
        if (childWithShadow.shadowRoot && depth < maxDepth - 2) {
          result.push(
            ...window.VSC.DomUtils.getShadow(childWithShadow.shadowRoot, maxDepth - depth)
          );
        }

        child = child.nextElementSibling;
      } while (child);
    }
  }

  getChild(parent);
  return result.flat(Infinity) as Element[];
};

window.VSC.DomUtils.findVideoParent = function (element: HTMLElement): HTMLElement {
  let parentElement = element.parentElement as HTMLElement;

  while (
    parentElement.parentNode &&
    (parentElement.parentNode as HTMLElement).offsetHeight === parentElement.offsetHeight &&
    (parentElement.parentNode as HTMLElement).offsetWidth === parentElement.offsetWidth
  ) {
    parentElement = parentElement.parentNode as HTMLElement;
  }

  return parentElement;
};

window.VSC.DomUtils.initializeWhenReady = function (
  document: Document,
  callback: (doc: Document) => void
): void {
  window.VSC.logger.debug('Begin initializeWhenReady');

  const handleWindowLoad = () => {
    callback(window.document);
  };

  window.addEventListener('load', handleWindowLoad, { once: true });

  if (document) {
    if (document.readyState === 'complete') {
      callback(document);
    } else {
      const handleReadyStateChange = () => {
        if (document.readyState === 'complete') {
          document.removeEventListener('readystatechange', handleReadyStateChange);
          callback(document);
        }
      };
      document.addEventListener('readystatechange', handleReadyStateChange);
    }
  }

  window.VSC.logger.debug('End initializeWhenReady');
};

window.VSC.DomUtils.findMediaElements = function (
  node: any,
  audioEnabled = false
): HTMLMediaElement[] {
  if (!node) {
    return [];
  }

  const mediaElements: HTMLMediaElement[] = [];
  const selector = audioEnabled ? 'video,audio' : 'video';

  if (node && node.matches && node.matches(selector)) {
    mediaElements.push(node as HTMLMediaElement);
  }

  if (node.querySelectorAll) {
    mediaElements.push(...(Array.from(node.querySelectorAll(selector)) as HTMLMediaElement[]));
  }

  if (node.shadowRoot) {
    mediaElements.push(...window.VSC.DomUtils.findShadowMedia(node.shadowRoot, selector));
  }

  return mediaElements;
};

window.VSC.DomUtils.findShadowMedia = function (
  root: ShadowRoot | Document | Element,
  selector: string
): HTMLMediaElement[] {
  const results: HTMLMediaElement[] = [];
  const rootWithShadow = root as Element & { shadowRoot?: ShadowRoot | null };

  if (rootWithShadow.shadowRoot) {
    results.push(...window.VSC.DomUtils.findShadowMedia(rootWithShadow.shadowRoot, selector));
  }

  if ('querySelectorAll' in root && root.querySelectorAll) {
    results.push(...(Array.from(root.querySelectorAll(selector)) as HTMLMediaElement[]));
  }

  if ('querySelectorAll' in root && root.querySelectorAll) {
    const allElements = Array.from(root.querySelectorAll('*')) as Array<
      Element & { shadowRoot?: ShadowRoot | null }
    >;
    allElements.forEach((element) => {
      if (element.shadowRoot) {
        results.push(...window.VSC.DomUtils.findShadowMedia(element.shadowRoot, selector));
      }
    });
  }

  return results;
};
