import type { SubtitleUpdatePayload } from "@/lib/audio";

export interface SubtitleEntry {
  id: string;
  original: string;
  translation: string;
  tokenSource: string;
  final: boolean;
}

export interface SubtitleToken {
  text: string;
  hl: boolean;
}

export function parseTokens(raw: string): SubtitleToken[] {
  return raw.split("|").map((piece) => {
    const hl = piece.startsWith("*");
    return { text: hl ? piece.slice(1) : piece, hl };
  });
}

export function applySubtitleUpdate(
  entries: SubtitleEntry[],
  payload: SubtitleUpdatePayload,
): SubtitleEntry[] {
  const original = payload.original.trim();
  const translation = payload.translation.trim();
  if (!original && !translation) return entries;

  const tokenSource = payload.tokens?.trim() || translation;
  const { sentenceId, sentenceEnd } = payload;

  if (sentenceId) {
    const lastIdx = entries.length - 1;
    const last = entries[lastIdx];
    if (last && last.id === sentenceId) {
      const updated: SubtitleEntry = {
        ...last,
        original: original || last.original,
        translation: translation || last.translation,
        tokenSource: tokenSource || last.tokenSource,
        final: sentenceEnd || last.final,
      };
      return [...entries.slice(0, lastIdx), updated];
    }

    return [
      ...entries,
      {
        id: sentenceId,
        original,
        translation,
        tokenSource,
        final: sentenceEnd,
      },
    ];
  }

  return [
    ...entries,
    {
      id: `modular-${Date.now()}-${entries.length}`,
      original,
      translation,
      tokenSource,
      final: true,
    },
  ];
}
