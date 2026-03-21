import { findVideoParent } from '../utils/dom-utils';
import { logger } from '../utils/logger';

export class DragHandler {
  static handleDrag(video: any, e: MouseEvent): void {
    const controller = video.vsc.div as HTMLElement & { shadowRoot: ShadowRoot };
    const shadowController = controller.shadowRoot.querySelector('#controller') as HTMLElement;
    const parentElement = findVideoParent(controller) as HTMLElement;

    video.classList.add('vcs-dragging');
    shadowController.classList.add('dragging');

    const initialMouseXY = [e.clientX, e.clientY];
    const initialControllerXY = [
      parseInt(shadowController.style.left) || 0,
      parseInt(shadowController.style.top) || 0,
    ];

    const startDragging = (moveEvent: MouseEvent) => {
      const style = shadowController.style;
      const dx = moveEvent.clientX - initialMouseXY[0];
      const dy = moveEvent.clientY - initialMouseXY[1];

      style.left = `${initialControllerXY[0] + dx}px`;
      style.top = `${initialControllerXY[1] + dy}px`;
    };

    const stopDragging = () => {
      parentElement.removeEventListener('mousemove', startDragging);
      parentElement.removeEventListener('mouseup', stopDragging);
      parentElement.removeEventListener('mouseleave', stopDragging);

      shadowController.classList.remove('dragging');
      video.classList.remove('vcs-dragging');
      logger.debug('Drag operation completed');
    };

    parentElement.addEventListener('mouseup', stopDragging);
    parentElement.addEventListener('mouseleave', stopDragging);
    parentElement.addEventListener('mousemove', startDragging);
    logger.debug('Drag operation started');
  }
}
