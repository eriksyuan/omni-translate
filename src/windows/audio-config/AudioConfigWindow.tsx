import { WindowShell } from "../shared/WindowShell";

export function AudioConfigWindow() {
  return (
    <WindowShell
      title="音频实时翻译配置"
      description="动态依赖检测、音频输入源与 ASR / 翻译引擎选择（UI 骨架）。"
      placeholder="Phase 2：接入 BlackHole 检测与状态 A/B 双态。"
    />
  );
}
