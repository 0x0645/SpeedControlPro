window.VSC = window.VSC || {};

class VideoMutationObserver {
  config: any;
  onVideoFound: (video: HTMLMediaElement, parent: Node | null) => void;
  onVideoRemoved: (video: HTMLMediaElement) => void;
  mediaObserver: any;
  observer: MutationObserver | null;
  shadowObservers: Map<ShadowRoot, MutationObserver>;

  constructor(
    config: any,
    onVideoFound: (video: HTMLMediaElement, parent: Node | null) => void,
    onVideoRemoved: (video: HTMLMediaElement) => void,
    mediaObserver: any
  ) {
    this.config = config;
    this.onVideoFound = onVideoFound;
    this.onVideoRemoved = onVideoRemoved;
    this.mediaObserver = mediaObserver;
    this.observer = null;
    this.shadowObservers = new Map();
  }

  scheduleIdleWork(callback: () => void, timeout = 2000): void {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout });
      return;
    }

    globalThis.setTimeout(callback, 0);
  }

  getMediaElementsFromNode(node: Element | ShadowRoot | Document): HTMLMediaElement[] {
    const mediaElements = window.VSC.DomUtils.findMediaElements(
      node,
      this.config.settings.audioBoolean
    ) as HTMLMediaElement[];
    return [...new Set(mediaElements)];
  }

  observeNestedShadowRoots(node: Node | null): void {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element & { shadowRoot?: ShadowRoot | null };

    if (element.shadowRoot) {
      this.observeShadowRoot(element.shadowRoot);
    }

    if (!element.querySelectorAll) {
      return;
    }

    element.querySelectorAll('*').forEach((child) => {
      const childWithShadow = child as Element & { shadowRoot?: ShadowRoot | null };
      if (childWithShadow.shadowRoot) {
        this.observeShadowRoot(childWithShadow.shadowRoot);
      }
    });
  }

  notifyMediaCallbacks(
    mediaElements: HTMLMediaElement[],
    parent: Node | null,
    added: boolean
  ): void {
    mediaElements.forEach((media) => {
      if (added) {
        this.onVideoFound(media, media.parentElement || media.parentNode || parent);
      } else if ((media as any).vsc) {
        this.onVideoRemoved(media);
      }
    });
  }

  start(document: Document): void {
    this.observer = new MutationObserver((mutations) => {
      this.scheduleIdleWork(() => {
        this.processMutations(mutations);
      }, 2000);
    });

    this.observer.observe(document, {
      attributeFilter: ['aria-hidden', 'data-focus-method', 'style', 'class'],
      childList: true,
      subtree: true,
    });
    window.VSC.logger.debug('Video mutation observer started');
  }

  processMutations(mutations: MutationRecord[]): void {
    mutations.forEach((mutation) => {
      switch (mutation.type) {
        case 'childList':
          this.processChildListMutation(mutation);
          break;
        case 'attributes':
          this.processAttributeMutation(mutation);
          break;
      }
    });
  }

  processChildListMutation(mutation: MutationRecord): void {
    mutation.addedNodes.forEach((node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node === document.documentElement) {
        window.VSC.logger.debug('Document was replaced, reinitializing');
        this.onDocumentReplaced();
        return;
      }

      this.checkForVideoAndShadowRoot(node, node.parentNode || mutation.target, true);
    });

    mutation.removedNodes.forEach((node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      this.checkForVideoAndShadowRoot(node, node.parentNode || mutation.target, false);
    });
  }

  processAttributeMutation(mutation: MutationRecord): void {
    const target = mutation.target as Element & { attributes: any; nodeName: string };

    if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
      this.handleVisibilityChanges(target);
    }

    if (
      (target.attributes['aria-hidden'] && target.attributes['aria-hidden'].value === 'false') ||
      target.nodeName === 'APPLE-TV-PLUS-PLAYER'
    ) {
      const flattenedNodes = window.VSC.DomUtils.getShadow(document.body) as Array<any>;
      const videoNodes = flattenedNodes.filter((node) => node.tagName === 'VIDEO');

      for (const node of videoNodes) {
        if (node.vsc && target.nodeName === 'APPLE-TV-PLUS-PLAYER') {
          continue;
        }

        if (node.vsc) {
          node.vsc.remove();
        }

        this.checkForVideoAndShadowRoot(node, node.parentNode || mutation.target, true);
      }
    }
  }

  handleVisibilityChanges(element: Element): void {
    if (
      element.tagName === 'VIDEO' ||
      (element.tagName === 'AUDIO' && this.config.settings.audioBoolean)
    ) {
      this.recheckVideoElement(element as HTMLMediaElement);
      return;
    }

    const mediaTagSelector = this.config.settings.audioBoolean ? 'video,audio' : 'video';
    const videos = element.querySelectorAll ? element.querySelectorAll(mediaTagSelector) : [];

    videos.forEach((video) => {
      this.recheckVideoElement(video as HTMLMediaElement);
    });
  }

  recheckVideoElement(video: HTMLMediaElement & { vsc?: any }): void {
    if (!this.mediaObserver) {
      return;
    }

    if (video.vsc) {
      if (!this.mediaObserver.isValidMediaElement(video)) {
        window.VSC.logger.debug('Video became invalid, removing controller');
        video.vsc.remove();
        video.vsc = null;
      } else {
        video.vsc.updateVisibility();
      }
      return;
    }

    if (this.mediaObserver.isValidMediaElement(video)) {
      window.VSC.logger.debug('Video became valid, attaching controller');
      this.onVideoFound(video, video.parentElement || video.parentNode);
    }
  }

  checkForVideoAndShadowRoot(node: Node, parent: Node | null, added: boolean): void {
    if (!added && document.body?.contains(node)) {
      return;
    }

    if (
      node.nodeName === 'VIDEO' ||
      (node.nodeName === 'AUDIO' && this.config.settings.audioBoolean)
    ) {
      if (added) {
        this.onVideoFound(node as HTMLMediaElement, parent);
      } else if ((node as any).vsc) {
        this.onVideoRemoved(node as HTMLMediaElement);
      }
      return;
    }

    this.processNodeChildren(node, parent, added);
  }

  processNodeChildren(node: Node, parent: Node | null, added: boolean): void {
    this.observeNestedShadowRoots(node);
    if (node instanceof Element || node instanceof Document || node instanceof ShadowRoot) {
      this.notifyMediaCallbacks(this.getMediaElementsFromNode(node), parent, added);
    }
  }

  observeShadowRoot(shadowRoot: ShadowRoot): void {
    if (this.shadowObservers.has(shadowRoot)) {
      return;
    }

    const shadowObserver = new MutationObserver((mutations) => {
      this.scheduleIdleWork(() => {
        this.processMutations(mutations);
      }, 500);
    });

    shadowObserver.observe(shadowRoot, {
      attributeFilter: ['aria-hidden', 'data-focus-method'],
      childList: true,
      subtree: true,
    });
    this.shadowObservers.set(shadowRoot, shadowObserver);

    window.VSC.logger.debug('Shadow root observer added');
  }

  onDocumentReplaced(): void {
    window.VSC.logger.warn('Document replacement detected - full reinitialization needed');
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.shadowObservers.forEach((shadowObserver) => {
      shadowObserver.disconnect();
    });
    this.shadowObservers.clear();

    window.VSC.logger.debug('Video mutation observer stopped');
  }
}

window.VSC.VideoMutationObserver = VideoMutationObserver;
