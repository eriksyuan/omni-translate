import { WindowShell } from "../shared/WindowShell";

export function OcrPermissionWindow() {
  return (
    <WindowShell
      title="需要屏幕录制权限"
      description="Just-in-Time 权限说明与系统设置引导（UI 骨架）。"
      placeholder="Phase 2：授权检测与跳转系统设置。"
    />
  );
}
