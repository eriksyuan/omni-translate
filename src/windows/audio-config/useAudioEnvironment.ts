import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  BLACKHOLE_INSTALL_GUIDE_URL,
  getAudioCaptureStatus,
  getAudioEnvironment,
  requestMicrophonePermission,
  type AudioEnvironmentStatus,
  type AudioSourceKind,
} from "@/lib/audio";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 30;

const DEFAULT_ENV: AudioEnvironmentStatus = {
  microphone: "notDetermined",
  blackholeInstalled: false,
  inputDevices: [],
};

export function useAudioEnvironment(source: AudioSourceKind) {
  const { t } = useTranslation();
  const [env, setEnv] = useState<AudioEnvironmentStatus>(DEFAULT_ENV);
  const [loading, setLoading] = useState(true);
  const [requestingMic, setRequestingMic] = useState(false);
  const [checkingBlackhole, setCheckingBlackhole] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollAttempts.current = 0;
    setCheckingBlackhole(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }

    try {
      const next = await getAudioEnvironment();
      setEnv(next);
      if (next.blackholeInstalled) {
        stopPolling();
      }
    } catch {
      // Keep last known environment on transient failures.
    } finally {
      setLoading(false);
    }
  }, [stopPolling]);

  const startBlackholePolling = useCallback(() => {
    stopPolling();
    setCheckingBlackhole(true);
    pollAttempts.current = 0;

    pollTimer.current = setInterval(() => {
      pollAttempts.current += 1;
      void refresh();

      if (pollAttempts.current >= POLL_MAX_ATTEMPTS) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [refresh, stopPolling]);

  const openBlackholeGuide = useCallback(async () => {
    if (isTauri()) {
      await openUrl(BLACKHOLE_INSTALL_GUIDE_URL);
    } else {
      window.open(BLACKHOLE_INSTALL_GUIDE_URL, "_blank", "noopener,noreferrer");
    }
    startBlackholePolling();
  }, [startBlackholePolling]);

  const requestMic = useCallback(async () => {
    if (!isTauri()) return;

    setRequestingMic(true);
    try {
      const permission = await requestMicrophonePermission();
      setEnv((current) => ({ ...current, microphone: permission }));
      await refresh();
    } finally {
      setRequestingMic(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();

    if (!isTauri()) return;

    let unlistenFocus: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          void refresh();
        }
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      });

    return () => {
      unlistenFocus?.();
      stopPolling();
    };
  }, [refresh, stopPolling]);

  const micGranted = env.microphone === "granted";
  const micDenied = env.microphone === "denied" || env.microphone === "restricted";
  const micNeedsGrant =
    env.microphone === "notDetermined" || env.microphone === "unknown";
  const ready =
    source === "blackhole"
      ? env.blackholeInstalled && micGranted
      : micGranted;

  const micDeviceOptions = env.inputDevices
    .filter((device) => !device.isBlackhole)
    .map((device) => ({
      value: device.id,
      label: device.isDefault
        ? t("audioConfig.device.default", { name: device.name })
        : device.name,
    }));

  return {
    env,
    loading,
    ready,
    micGranted,
    micDenied,
    micNeedsGrant,
    requestingMic,
    checkingBlackhole,
    micDeviceOptions,
    refresh,
    requestMic,
    openBlackholeGuide,
    syncCaptureStatus: getAudioCaptureStatus,
  };
}
