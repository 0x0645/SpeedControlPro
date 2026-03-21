import { BRIDGE_ACTIONS, BRIDGE_SOURCES, MESSAGE_TYPES } from '../utils/message-types.ts';

window.VSC = window.VSC || {};

type ControllerInfo = {
  controller?: { video?: HTMLMediaElement | null } | null;
  element?: HTMLMediaElement | null;
  tagName?: string;
  videoSrc?: string;
  created?: number;
};

class VSCStateManager {
  controllers: Map<string, ControllerInfo>;
  mediaIndex: WeakMap<HTMLMediaElement, string>;
  notificationTimer: number | null;
  notificationDelay: number;

  constructor() {
    this.controllers = new Map();
    this.mediaIndex = new WeakMap();
    this.notificationTimer = null;
    this.notificationDelay = 25;

    window.VSC.logger?.debug('VSCStateManager initialized');
  }

  __resetForTests() {
    this.controllers.clear();
    this.mediaIndex = new WeakMap();

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
  }

  getStateSnapshot() {
    return {
      type: MESSAGE_TYPES.STATE_UPDATE,
      hasActiveControllers: this.controllers.size > 0,
      controllerCount: this.controllers.size,
    };
  }

  postStateUpdate() {
    window.postMessage(
      {
        source: BRIDGE_SOURCES.PAGE,
        action: BRIDGE_ACTIONS.RUNTIME_MESSAGE,
        data: this.getStateSnapshot(),
      },
      '*'
    );
  }

  scheduleStateUpdate() {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }

    this.notificationTimer = window.setTimeout(() => {
      this.notificationTimer = null;
      this.postStateUpdate();
    }, this.notificationDelay);
  }

  registerController(controller: { controllerId?: string; video?: HTMLMediaElement | null }) {
    if (!controller || !controller.controllerId) {
      window.VSC.logger?.warn('Invalid controller registration attempt');
      return;
    }

    const controllerInfo: ControllerInfo = {
      controller,
      element: controller.video,
      tagName: controller.video?.tagName,
      videoSrc: controller.video?.src || controller.video?.currentSrc,
      created: Date.now(),
    };

    this.controllers.set(controller.controllerId, controllerInfo);
    if (controller.video) {
      this.mediaIndex.set(controller.video, controller.controllerId);
    }
    window.VSC.logger?.debug(`Controller registered: ${controller.controllerId}`);
    this.scheduleStateUpdate();
  }

  unregisterController(controllerId: string) {
    if (this.controllers.has(controllerId)) {
      const info = this.controllers.get(controllerId);
      const media = info?.controller?.video || info?.element;
      if (media) {
        this.mediaIndex.delete(media);
      }
      this.controllers.delete(controllerId);
      window.VSC.logger?.debug(`Controller unregistered: ${controllerId}`);
      this.scheduleStateUpdate();
    }
  }

  getAllMediaElements(): HTMLMediaElement[] {
    const elements: HTMLMediaElement[] = [];

    for (const [id, info] of this.controllers) {
      const video = info.controller?.video || info.element;
      if (video && video.isConnected) {
        elements.push(video);
      } else {
        if (video) {
          this.mediaIndex.delete(video);
        }
        this.controllers.delete(id);
        this.scheduleStateUpdate();
      }
    }

    return elements;
  }

  getMediaByControllerId(controllerId: string): HTMLMediaElement | null {
    const info = this.controllers.get(controllerId);
    return info?.controller?.video || info?.element || null;
  }

  getFirstMedia(): HTMLMediaElement | null {
    const elements = this.getAllMediaElements();
    return elements[0] || null;
  }

  hasMediaElement(media: HTMLMediaElement | null | undefined): boolean {
    if (!media) {
      return false;
    }

    const controllerId = this.mediaIndex.get(media);
    if (!controllerId) {
      return false;
    }

    if (!this.controllers.has(controllerId)) {
      this.mediaIndex.delete(media);
      return false;
    }

    return true;
  }

  hasControllers(): boolean {
    return this.controllers.size > 0;
  }

  removeController(controllerId: string) {
    this.unregisterController(controllerId);
  }

  getControlledElements(): HTMLMediaElement[] {
    return this.getAllMediaElements();
  }
}

window.VSC.StateManager = VSCStateManager;
window.VSC.stateManager = new VSCStateManager();

window.VSC.logger?.info('State Manager module loaded');
