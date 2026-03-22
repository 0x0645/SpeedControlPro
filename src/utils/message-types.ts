export const MESSAGE_TYPES = Object.freeze({
  SET_SPEED: 'VSC_SET_SPEED',
  ADJUST_SPEED: 'VSC_ADJUST_SPEED',
  RESET_SPEED: 'VSC_RESET_SPEED',
  TOGGLE_DISPLAY: 'VSC_TOGGLE_DISPLAY',
  SET_SITE_PROFILE: 'VSC_SET_SITE_PROFILE',
  REMOVE_SITE_PROFILE: 'VSC_REMOVE_SITE_PROFILE',
  GET_SITE_INFO: 'VSC_GET_SITE_INFO',
  STATE_UPDATE: 'VSC_STATE_UPDATE',
} as const);

export const BRIDGE_SOURCES = Object.freeze({
  PAGE: 'vsc-page',
  CONTENT: 'vsc-content',
} as const);

export const BRIDGE_ACTIONS = Object.freeze({
  STORAGE_UPDATE: 'storage-update',
  RUNTIME_MESSAGE: 'runtime-message',
  RUNTIME_MESSAGE_IN: 'runtime-message-in',
  GET_STORAGE: 'get-storage',
  STORAGE_DATA: 'storage-data',
  STORAGE_CHANGED: 'storage-changed',
  CURRENT_SPEED_RESPONSE: 'current-speed-response',
  STATUS_RESPONSE: 'status-response',
} as const);

export const EXTENSION_MESSAGES = Object.freeze({
  TOGGLE: 'EXTENSION_TOGGLE',
  TAB_SPEED_UPDATE: 'VSC_TAB_SPEED_UPDATE',
} as const);
