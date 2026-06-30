# OmniTranslate

macOS 状态栏实时字幕翻译工具（Tauri 2 + React + TypeScript）。

## 开发

```bash
pnpm install
pnpm tauri dev
```

## 项目结构

```
src/              React 前端（按 Tauri 窗口 label 分模块）
src-tauri/        Rust 后端、Tray、窗口管理
open-design/      高保真设计稿（只读）
docs/             需求与架构文档
```

## 窗口 label

| Label            | 用途             |
| ---------------- | ---------------- |
| `tray-menu`      | 状态栏下拉菜单   |
| `audio-config`   | 音频实时翻译配置 |
| `ocr-permission` | OCR 权限引导     |
| `ocr-overlay`    | 全屏选区遮罩     |
| `subtitle`       | 悬浮字幕         |
| `preferences`    | 服务设置         |
