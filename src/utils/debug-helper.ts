import { logger } from './logger';
import { LOG_LEVELS } from './constants';

export class DebugHelper {
  isActive = false;

  enable(): void {
    this.isActive = true;
    console.log('VSC Debug Mode Enabled');

    logger.setVerbosity(LOG_LEVELS.DEBUG);

    (window as any).vscDebug = {
      checkMedia: () => this.checkMediaElements(),
      checkControllers: () => this.checkControllers(),
      testPopup: () => this.testPopupCommunication(),
      testBridge: () => this.testPopupMessageBridge(),
      forceShow: () => this.forceShowControllers(),
      forceShowAudio: () => this.forceShowAudioControllers(),
      getVisibility: (element: Element) => this.getElementVisibility(element),
    };
  }

  checkMediaElements(): void {
    console.group('Media Elements Analysis');
    const videos = document.querySelectorAll('video');
    const audios = document.querySelectorAll('audio');
    console.log(`Found ${videos.length} video elements, ${audios.length} audio elements`);

    [...videos, ...audios].forEach((media: any, index) => {
      console.group(`${media.tagName} #${index + 1}`);
      console.log('Element:', media);
      console.log('Connected to DOM:', media.isConnected);
      console.log('Has VSC controller:', !!media.vsc);
      console.log('Current source:', media.currentSrc || media.src || 'No source');
      console.log('Ready state:', media.readyState);
      console.log('Paused:', media.paused);
      console.log('Duration:', media.duration);
      const style = window.getComputedStyle(media);
      console.log('Computed styles:', {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: style.width,
        height: style.height,
      });
      const rect = media.getBoundingClientRect();
      console.log('Bounding rect:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        visible: rect.width > 0 && rect.height > 0,
      });
      if (window.VSC_controller?.mediaObserver) {
        const observer = window.VSC_controller.mediaObserver;
        console.log('VSC would detect:', observer.isValidMediaElement(media));
        console.log('VSC would start hidden:', observer.shouldStartHidden(media));
      }
      console.groupEnd();
    });

    this.checkShadowDOMMedia();
    console.groupEnd();
  }

  checkShadowDOMMedia(): void {
    console.group('Shadow DOM Media Check');
    let shadowMediaCount = 0;
    const checkElement = (element: Element & { shadowRoot?: ShadowRoot | null }) => {
      if (element.shadowRoot) {
        const shadowMedia = element.shadowRoot.querySelectorAll('video, audio');
        if (shadowMedia.length > 0) {
          console.log(`Found ${shadowMedia.length} media elements in shadow DOM of:`, element);
          shadowMediaCount += shadowMedia.length;
        }
        element.shadowRoot
          .querySelectorAll('*')
          .forEach((child) => checkElement(child as Element & { shadowRoot?: ShadowRoot | null }));
      }
    };
    document
      .querySelectorAll('*')
      .forEach((el) => checkElement(el as Element & { shadowRoot?: ShadowRoot | null }));
    console.log(`Total shadow DOM media elements: ${shadowMediaCount}`);
    console.groupEnd();
  }

  checkControllers(): void {
    console.group('Controllers Analysis');
    const controllers = document.querySelectorAll('vsc-controller');
    console.log(`Found ${controllers.length} VSC controllers`);
    controllers.forEach((controller: any, index) => {
      console.group(`Controller #${index + 1}`);
      console.log('Element:', controller);
      console.log('Classes:', controller.className);
      const style = window.getComputedStyle(controller);
      console.log('Computed styles:', {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        top: style.top,
        left: style.left,
        zIndex: style.zIndex,
      });
      console.log('VSC State:', {
        hidden: controller.classList.contains('vsc-hidden'),
        manual: controller.classList.contains('vsc-manual'),
        noSource: controller.classList.contains('vsc-nosource'),
        effectivelyVisible:
          !controller.classList.contains('vsc-hidden') && style.display !== 'none',
      });
      console.groupEnd();
    });
    console.groupEnd();
  }

  testPopupCommunication(): void {
    console.group('Popup Communication Test');
    const videos = document.querySelectorAll('video, audio');
    if (window.VSC_controller && window.VSC_controller.actionHandler) {
      const testSpeed = 1.5;
      videos.forEach((video: any) => {
        if (video.vsc) {
          window.VSC_controller.actionHandler.adjustSpeed(video, testSpeed);
        } else {
          video.playbackRate = testSpeed;
        }
      });
    }
    console.groupEnd();
  }

  testPopupMessageBridge(): void {
    const testMessages = [
      { type: 'VSC_SET_SPEED', payload: { speed: 1.25 } },
      { type: 'VSC_ADJUST_SPEED', payload: { delta: 0.25 } },
      { type: 'VSC_RESET_SPEED' },
    ];

    testMessages.forEach((message, index) => {
      globalThis.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('VSC_MESSAGE', { detail: message }));
      }, index * 1500);
    });
  }

  forceShowControllers(): number {
    const controllers = document.querySelectorAll('vsc-controller');
    controllers.forEach((controller: any) => {
      controller.classList.remove('vsc-hidden', 'vsc-nosource');
      controller.classList.add('vsc-manual', 'vsc-show');
    });
    return controllers.length;
  }

  forceShowAudioControllers(): number {
    const audioElements = document.querySelectorAll('audio');
    let controllersShown = 0;
    audioElements.forEach((audio: any) => {
      if (audio.vsc && audio.vsc.div) {
        const controller = audio.vsc.div;
        controller.classList.remove('vsc-hidden', 'vsc-nosource');
        controller.classList.add('vsc-manual', 'vsc-show');
        controllersShown++;
      }
    });
    return controllersShown;
  }

  getElementVisibility(element: Element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      connected: (element as any).isConnected,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: rect.width,
      height: rect.height,
      isVisible:
        (element as any).isConnected &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0,
    };
  }

  monitorControllerChanges(): MutationObserver {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'class' || mutation.attributeName === 'style')
        ) {
          const target = mutation.target as Element;
          if (target.tagName === 'VSC-CONTROLLER') {
            console.log('Controller visibility changed:', target);
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'style'],
    });

    return observer;
  }
}

export const debugHelper = new DebugHelper();
(window as any).vscDebugHelper = debugHelper;
