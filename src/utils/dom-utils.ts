import { logger } from './logger';

export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getShadow(parent: Element | ShadowRoot, maxDepth = 10): Element[] {
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
          result.push(...getShadow(childWithShadow.shadowRoot, maxDepth - depth));
        }

        child = child.nextElementSibling;
      } while (child);
    }
  }

  getChild(parent);
  return result.flat(Infinity) as Element[];
}

export function findVideoParent(element: HTMLElement): HTMLElement {
  let parentElement = element.parentElement as HTMLElement;

  while (
    parentElement.parentNode &&
    (parentElement.parentNode as HTMLElement).offsetHeight === parentElement.offsetHeight &&
    (parentElement.parentNode as HTMLElement).offsetWidth === parentElement.offsetWidth
  ) {
    parentElement = parentElement.parentNode as HTMLElement;
  }

  return parentElement;
}

export function initializeWhenReady(document: Document, callback: (doc: Document) => void): void {
  logger.debug('Begin initializeWhenReady');

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

  logger.debug('End initializeWhenReady');
}

export function findMediaElements(
  node: Element | Document | ShadowRoot | null,
  audioEnabled = false
): HTMLMediaElement[] {
  if (!node) {
    return [];
  }

  const mediaElements: HTMLMediaElement[] = [];
  const selector = audioEnabled ? 'video,audio' : 'video';

  if ('matches' in node && (node as Element).matches(selector)) {
    mediaElements.push(node as HTMLMediaElement);
  }

  if ('querySelectorAll' in node) {
    mediaElements.push(...(Array.from(node.querySelectorAll(selector)) as HTMLMediaElement[]));
  }

  if ('shadowRoot' in node && (node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
    mediaElements.push(
      ...findShadowMedia((node as Element & { shadowRoot: ShadowRoot }).shadowRoot, selector)
    );
  }

  return mediaElements;
}

export function findShadowMedia(
  root: ShadowRoot | Document | Element,
  selector: string
): HTMLMediaElement[] {
  const results: HTMLMediaElement[] = [];
  const rootWithShadow = root as Element & { shadowRoot?: ShadowRoot | null };

  if (rootWithShadow.shadowRoot) {
    results.push(...findShadowMedia(rootWithShadow.shadowRoot, selector));
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
        results.push(...findShadowMedia(element.shadowRoot, selector));
      }
    });
  }

  return results;
}
