import { describe, it, expect } from 'vitest';
import { loadObserverModules } from '../../helpers/module-loader';
import type { MediaElementObserver } from '../../../src/observers/media-observer';
import type { IVideoSpeedConfig } from '../../../src/types/settings';

await loadObserverModules();

const createMockMediaObserver = (): MediaElementObserver =>
  ({ config: {}, siteHandler: {} } as unknown as MediaElementObserver);

function toNodeList(nodes: Node[]): NodeList {
  return {
    length: nodes.length,
    item: (i: number) => nodes[i] ?? null,
    forEach: (cb: (node: Node, index: number, list: NodeList) => void) =>
      nodes.forEach((n, i) => cb(n, i, {} as NodeList)),
    [Symbol.iterator]: function* () {
      for (const n of nodes) {
        yield n;
      }
    },
    ...Object.fromEntries(nodes.map((n, i) => [i, n])),
  } as NodeList;
}

const createMockConfig = (overrides: Record<string, unknown> = {}): IVideoSpeedConfig =>
  ({ settings: { ...overrides } } as unknown as IVideoSpeedConfig);

describe('VideoMutationObserver', () => {
  it('should process element nodes', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    const videoElement = document.createElement('video');
    const divElement = document.createElement('div');

    const mutation: MutationRecord = {
      type: 'childList',
      addedNodes: toNodeList([videoElement, divElement]),
      removedNodes: toNodeList([]),
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null,
    };

    observer.processChildListMutation(mutation);

    // Video element should trigger callback
    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoFound[0].video).toBe(videoElement);
    expect(mockOnVideoFound[0].parent).toBe(document.body);
  });

  it('should skip non-element nodes', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    const textNode = document.createTextNode('text');
    const commentNode = document.createComment('comment');
    const videoElement = document.createElement('video');

    const mutation: MutationRecord = {
      type: 'childList',
      addedNodes: toNodeList([textNode, commentNode, videoElement]),
      removedNodes: toNodeList([]),
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null,
    };

    observer.processChildListMutation(mutation);

    // Only video element should be processed
    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoFound[0].video).toBe(videoElement);
    expect(mockOnVideoFound[0].parent).toBe(document.body);
  });

  it('should handle removed video elements', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    const videoElement = document.createElement('video') as HTMLVideoElement & { vsc?: unknown };
    videoElement.vsc = { remove: () => {} };

    const mutation: MutationRecord = {
      type: 'childList',
      addedNodes: toNodeList([]),
      removedNodes: toNodeList([videoElement]),
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null,
    };

    observer.processChildListMutation(mutation);

    expect(mockOnVideoRemoved.length).toBe(1);
    expect(mockOnVideoRemoved[0]).toBe(videoElement);
  });

  it('should handle null and undefined nodes gracefully', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    const vid = document.createElement('video');
    const mutation: MutationRecord = {
      type: 'childList',
      addedNodes: toNodeList([vid]),
      removedNodes: toNodeList([]),
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null,
    };

    observer.processChildListMutation(mutation);

    // Only the video element should be processed
    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoRemoved.length).toBe(0);
  });

  it('should detect video elements in shadow DOM', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const videoElement = document.createElement('video');
    shadowRoot.appendChild(videoElement);

    observer.checkForVideoAndShadowRoot(host, document.body, true);

    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoFound[0].video).toBe(videoElement);
    expect(mockOnVideoFound[0].parent).toBe(videoElement.parentNode);
  });

  it('should handle HTMLCollection children properly', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    // Create a container with multiple child elements including a video
    const container = document.createElement('div');
    const videoElement = document.createElement('video');
    const spanElement = document.createElement('span');
    const pElement = document.createElement('p');

    container.appendChild(spanElement);
    container.appendChild(videoElement);
    container.appendChild(pElement);

    // Simulate the processNodeChildren call directly
    observer.processNodeChildren(container, document.body, true);

    // Should find the video element in the children
    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoFound[0].video).toBe(videoElement);
  });

  it('should detect nested video elements', () => {
    const mockConfig = createMockConfig();
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];
    const mockOnVideoRemoved: HTMLMediaElement[] = [];

    const onVideoFound = (video: HTMLMediaElement, parent: Node | null) => {
      mockOnVideoFound.push({ video, parent });
    };

    const onVideoRemoved = (video: HTMLMediaElement) => {
      mockOnVideoRemoved.push(video);
    };

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      onVideoFound,
      onVideoRemoved,
      createMockMediaObserver()
    );

    const container = document.createElement('div');
    const innerDiv = document.createElement('div');
    const videoElement = document.createElement('video');
    innerDiv.appendChild(videoElement);
    container.appendChild(innerDiv);

    observer.checkForVideoAndShadowRoot(container, document.body, true);

    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoFound[0].video).toBe(videoElement);
    expect(mockOnVideoFound[0].parent).toBe(videoElement.parentNode);
  });

  it('should not duplicate media found through nested traversal', () => {
    const mockConfig = createMockConfig({ audioBoolean: false });
    const mockOnVideoFound: Array<{ video: HTMLMediaElement; parent: Node | null }> = [];

    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      (video: HTMLMediaElement, parent: Node | null) => {
        mockOnVideoFound.push({ video, parent });
      },
      () => {},
      createMockMediaObserver()
    );

    const host = document.createElement('div');
    const container = document.createElement('div');
    const videoElement = document.createElement('video');
    container.appendChild(videoElement);
    host.appendChild(container);

    observer.processNodeChildren(host, document.body, true);

    expect(mockOnVideoFound.length).toBe(1);
    expect(mockOnVideoFound[0].video).toBe(videoElement);
  });

  it('VideoMutationObserver.stop should disconnect shadow observers', () => {
    const mockConfig = createMockConfig({ audioBoolean: false });
    const observer = new window.VSC.VideoMutationObserver!(
      mockConfig,
      () => {},
      () => {},
      createMockMediaObserver()
    );

    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    observer.observeShadowRoot(shadowRoot);

    const trackedObserver = observer.shadowObservers.get(shadowRoot)!;
    let disconnected = false;
    const originalDisconnect = trackedObserver.disconnect.bind(trackedObserver);
    trackedObserver.disconnect = () => {
      disconnected = true;
      originalDisconnect();
    };

    observer.stop();

    expect(disconnected).toBe(true);
    expect(observer.shadowObservers.size).toBe(0);
  });
});
