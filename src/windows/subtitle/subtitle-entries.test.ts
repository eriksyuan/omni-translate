import { describe, expect, it } from "vitest";
import { applySubtitleUpdate } from "./subtitle-entries";

describe("applySubtitleUpdate", () => {
  it("appends modular entries without sentenceId", () => {
    const first = applySubtitleUpdate([], {
      original: "hello",
      translation: "你好",
      sentenceEnd: true,
    });
    expect(first).toHaveLength(1);
    expect(first[0]?.original).toBe("hello");
    expect(first[0]?.translation).toBe("你好");
    expect(first[0]?.final).toBe(true);

    const second = applySubtitleUpdate(first, {
      original: "world",
      translation: "世界",
      sentenceEnd: true,
    });
    expect(second).toHaveLength(2);
    expect(second[1]?.translation).toBe("世界");
  });

  it("updates integrated entries in place for the same sentenceId", () => {
    const streaming = applySubtitleUpdate([], {
      original: "Hel",
      translation: "你",
      sentenceId: "sid-1",
      sentenceEnd: false,
    });
    expect(streaming).toHaveLength(1);
    expect(streaming[0]?.final).toBe(false);

    const updated = applySubtitleUpdate(streaming, {
      original: "Hello",
      translation: "你好",
      sentenceId: "sid-1",
      sentenceEnd: true,
    });
    expect(updated).toHaveLength(1);
    expect(updated[0]?.original).toBe("Hello");
    expect(updated[0]?.translation).toBe("你好");
    expect(updated[0]?.final).toBe(true);
  });

  it("appends a new integrated entry when sentenceId changes", () => {
    const first = applySubtitleUpdate([], {
      original: "A",
      translation: "甲",
      sentenceId: "sid-1",
      sentenceEnd: true,
    });
    const second = applySubtitleUpdate(first, {
      original: "B",
      translation: "乙",
      sentenceId: "sid-2",
      sentenceEnd: false,
    });
    expect(second).toHaveLength(2);
    expect(second[1]?.id).toBe("sid-2");
  });

  it("ignores stale partial updates after entry is final", () => {
    const final = applySubtitleUpdate([], {
      original: "Hello",
      translation: "你好",
      sentenceId: "sid-1",
      sentenceEnd: true,
    });
    const stale = applySubtitleUpdate(final, {
      original: "Hello world",
      translation: "你好世界",
      sentenceId: "sid-1",
      sentenceEnd: false,
    });
    expect(stale).toEqual(final);
  });

  it("appends a new entry when sentenceId advances after final", () => {
    const first = applySubtitleUpdate([], {
      original: "Hello",
      translation: "你好",
      sentenceId: "sid-1",
      sentenceEnd: true,
    });
    const second = applySubtitleUpdate(first, {
      original: "World",
      translation: "世界",
      sentenceId: "sid-2",
      sentenceEnd: false,
    });
    expect(second).toHaveLength(2);
    expect(second[0]?.final).toBe(true);
    expect(second[1]?.id).toBe("sid-2");
  });
});
