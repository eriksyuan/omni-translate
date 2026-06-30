export const WINDOW_LABELS = {
  TRAY_MENU: "tray-menu",
  AUDIO_CONFIG: "audio-config",
  OCR_PERMISSION: "ocr-permission",
  OCR_OVERLAY: "ocr-overlay",
  SUBTITLE: "subtitle",
  PREFERENCES: "preferences",
} as const;

export type WindowLabel = (typeof WINDOW_LABELS)[keyof typeof WINDOW_LABELS];

export const ALL_WINDOW_LABELS: WindowLabel[] = Object.values(WINDOW_LABELS);
