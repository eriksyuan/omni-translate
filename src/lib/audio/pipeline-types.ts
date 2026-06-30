export interface SubtitleUpdatePayload {
  original: string;
  translation: string;
  tokens?: string;
}

export interface PipelineErrorPayload {
  code: string;
  message: string;
}

export interface PipelineStatePayload {
  asrPending: boolean;
  mtPending: boolean;
}
