import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SherpaModel } from "@/lib/settings/types";

export type DownloadPhase =
  | "idle"
  | "downloading"
  | "paused"
  | "verifying"
  | "extracting"
  | "installed"
  | "error";

export interface SherpaModelStatus {
  modelId: string;
  installed: boolean;
  version: string | null;
  sizeBytes: number;
  phase: DownloadPhase;
  downloadedBytes: number;
  resumable: boolean;
  downloading: boolean;
  downloadProgress: number | null;
}

export interface ModelProgressPayload {
  modelId: string;
  downloaded: number;
  total: number;
  status: string;
}

export const EVENT_MODEL_PROGRESS = "model://progress";

export const SHERPA_MODELS = ["zipformer-en-20m", "zipformer-en-full"] as const satisfies readonly SherpaModel[];

export function getSherpaModelStatus(modelId: SherpaModel) {
  return invoke<SherpaModelStatus>("get_sherpa_model_status", { modelId });
}

export function listSherpaModelStatuses() {
  return invoke<SherpaModelStatus[]>("list_sherpa_model_statuses");
}

export function getSherpaModelFolder(modelId: SherpaModel) {
  return invoke<string>("get_sherpa_model_folder", { modelId });
}

export function downloadSherpaModel(modelId: SherpaModel) {
  return invoke<void>("download_sherpa_model", { modelId });
}

export function pauseSherpaModelDownload(modelId: SherpaModel) {
  return invoke<void>("pause_sherpa_model_download", { modelId });
}

export function resumeSherpaModelDownload(modelId: SherpaModel) {
  return invoke<void>("resume_sherpa_model_download", { modelId });
}

export function deleteSherpaModel(modelId: SherpaModel) {
  return invoke<void>("delete_sherpa_model", { modelId });
}

export function ensureSherpaModel(modelId: SherpaModel) {
  return invoke<void>("ensure_sherpa_model", { modelId });
}

export function listenModelProgress(
  handler: (payload: ModelProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ModelProgressPayload>(EVENT_MODEL_PROGRESS, (event) => {
    handler(event.payload);
  });
}

export function formatModelSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatDownloadProgress(downloaded: number, total: number): string {
  const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
  return `${formatModelSize(downloaded)} / ${formatModelSize(total)} (${percent}%)`;
}

export function progressPercent(status: SherpaModelStatus): number {
  if (status.installed) return 100;
  if (status.sizeBytes > 0) {
    return Math.min(100, Math.round((status.downloadedBytes / status.sizeBytes) * 100));
  }
  if (status.downloadProgress != null) {
    return Math.round(status.downloadProgress * 100);
  }
  return 0;
}

function phaseFromStatus(status: string): DownloadPhase {
  switch (status) {
    case "downloading":
    case "starting":
      return "downloading";
    case "paused":
      return "paused";
    case "verifying":
      return "verifying";
    case "extracting":
      return "extracting";
    case "complete":
      return "installed";
    default:
      if (status.startsWith("error")) return "error";
      return "idle";
  }
}

export function applyProgressPayload(
  current: SherpaModelStatus,
  payload: ModelProgressPayload,
): SherpaModelStatus {
  const phase = phaseFromStatus(payload.status);
  const installed = payload.status === "complete";
  return {
    ...current,
    installed,
    phase: installed ? "installed" : phase,
    downloadedBytes: payload.downloaded,
    sizeBytes: payload.total > 0 ? payload.total : current.sizeBytes,
    downloading: phase === "downloading",
    resumable: phase === "paused" || (phase === "error" && payload.downloaded > 0),
    downloadProgress: payload.total > 0 ? payload.downloaded / payload.total : current.downloadProgress,
  };
}
