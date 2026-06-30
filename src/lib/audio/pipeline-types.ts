export interface SubtitleUpdatePayload {
  original: string;
  translation: string;
  sentenceId?: string;
  sentenceEnd: boolean;
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

export interface SubtitleSentence {
  source: string;
  target: string;
  final: boolean;
}
