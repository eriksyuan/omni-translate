import { useCallback, useEffect, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";
import type { SherpaModel } from "@/lib/settings/types";
import {
  applyProgressPayload,
  downloadSherpaModel,
  getSherpaModelFolder,
  listSherpaModelStatuses,
  listenModelProgress,
  pauseSherpaModelDownload,
  resumeSherpaModelDownload,
  SHERPA_MODELS,
  type SherpaModelStatus,
} from "@/lib/models/sherpa";

function emptyStatus(modelId: SherpaModel): SherpaModelStatus {
  return {
    modelId,
    installed: false,
    version: null,
    sizeBytes: 0,
    phase: "idle",
    downloadedBytes: 0,
    resumable: false,
    downloading: false,
    downloadProgress: null,
  };
}

function normalizeModelId(status: SherpaModelStatus & { model_id?: string }): SherpaModel | null {
  const id = status.modelId ?? status.model_id;
  if (id === "zipformer-en-20m" || id === "zipformer-en-full") return id;
  return null;
}

function toRecord(statuses: SherpaModelStatus[]): Record<SherpaModel, SherpaModelStatus> {
  const map: Record<SherpaModel, SherpaModelStatus> = {
    "zipformer-en-20m": emptyStatus("zipformer-en-20m"),
    "zipformer-en-full": emptyStatus("zipformer-en-full"),
  };

  for (const status of statuses) {
    const modelId = normalizeModelId(status);
    if (modelId) {
      map[modelId] = { ...status, modelId };
    }
  }
  return map;
}

export function useSherpaModelDownloads(enabled: boolean) {
  const [statusByModel, setStatusByModel] = useState<Record<SherpaModel, SherpaModelStatus>>(() =>
    toRecord([]),
  );

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    const statuses = await listSherpaModelStatuses();
    setStatusByModel(toRecord(statuses));
  }, []);

  useEffect(() => {
    if (!enabled || !isTauri()) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !isTauri()) return;

    let unlisten: (() => void) | undefined;
    void listenModelProgress((payload) => {
      const modelId = payload.modelId as SherpaModel;
      if (!SHERPA_MODELS.includes(modelId)) return;

      setStatusByModel((prev) => {
        const current = prev[modelId] ?? emptyStatus(modelId);
        return { ...prev, [modelId]: applyProgressPayload(current, payload) };
      });

      if (payload.status === "complete" || payload.status.startsWith("error")) {
        void refresh();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [enabled, refresh]);

  const download = useCallback(async (modelId: SherpaModel) => {
    const status = statusByModel[modelId];
    if (status?.resumable && !status.downloading) {
      await resumeSherpaModelDownload(modelId);
      return;
    }
    await downloadSherpaModel(modelId);
  }, [statusByModel]);

  const pause = useCallback(async (modelId: SherpaModel) => {
    await pauseSherpaModelDownload(modelId);
  }, []);

  const resume = useCallback(async (modelId: SherpaModel) => {
    await resumeSherpaModelDownload(modelId);
  }, []);

  const openFolder = useCallback(async (modelId: SherpaModel) => {
    const folder = await getSherpaModelFolder(modelId);
    await openPath(folder);
  }, []);

  return {
    statusByModel,
    refresh,
    download,
    pause,
    resume,
    openFolder,
  };
}
