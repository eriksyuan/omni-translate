import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";
import {
  clearRecentLogs,
  formatLogLines,
  getLogFilePath,
  getRecentLogs,
  type LogEntry,
  type LogLevel,
} from "@/lib/logging";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-row";
import { cn } from "@/lib/cn";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

const LEVEL_CLASS: Record<LogLevel, string> = {
  trace: "text-fg-3",
  debug: "text-fg-2",
  info: "text-fg-1",
  warn: "text-amber-400",
  error: "text-red-400",
};

export function DiagnosticsLogSection() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [minLevel, setMinLevel] = useState<LogLevel>("info");
  const [logPath, setLogPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const [logs, path] = await Promise.all([
        getRecentLogs(800, minLevel),
        getLogFilePath(),
      ]);
      setEntries(logs);
      setLogPath(path);
    } finally {
      setLoading(false);
    }
  }, [minLevel]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !isTauri()) return;
    const id = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries]);

  const copyLogs = async () => {
    await navigator.clipboard.writeText(formatLogLines(entries));
  };

  const openLogFolder = async () => {
    if (!logPath) return;
    const folder = logPath.replace(/[/\\][^/\\]+$/, "");
    await openPath(folder);
  };

  const clearLogs = async () => {
    await clearRecentLogs();
    await refresh();
  };

  if (!isTauri()) {
    return null;
  }

  return (
    <div className="mt-[22px]">
      <div className="eyebrow mb-2.5">{t("diagnosticsLogs.group")}</div>
      <div className="formcard gap-3">
        <p className="text-[13px] text-fg-2 leading-[1.55] m-0">
          {t("diagnosticsLogs.help")}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <FormField id="log-level" label={t("diagnosticsLogs.level.label")}>
            <Select
              ariaLabel={t("diagnosticsLogs.level.label")}
              value={minLevel}
              onValueChange={(value) => setMinLevel(value as LogLevel)}
              options={LEVELS.map((level) => ({
                value: level,
                label: t(`diagnosticsLogs.level.${level}`),
              }))}
            />
          </FormField>

          <label className="inline-flex items-center gap-2 text-[13px] text-fg-2 pb-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            {t("diagnosticsLogs.autoRefresh")}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary text-[12px] px-3 py-1.5"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {t("diagnosticsLogs.refresh")}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-[12px] px-3 py-1.5"
            onClick={() => void copyLogs()}
            disabled={entries.length === 0}
          >
            {t("diagnosticsLogs.copy")}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-[12px] px-3 py-1.5"
            onClick={() => void openLogFolder()}
            disabled={!logPath}
          >
            {t("diagnosticsLogs.openFolder")}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-[12px] px-3 py-1.5"
            onClick={() => void clearLogs()}
          >
            {t("diagnosticsLogs.clearBuffer")}
          </button>
        </div>

        {logPath ? (
          <p className="text-[11px] text-fg-3 m-0 break-all font-mono">{logPath}</p>
        ) : null}

        <pre
          ref={logRef}
          className={cn(
            "m-0 max-h-[280px] overflow-auto rounded-lg border border-white/10",
            "bg-black/35 p-3 text-[11px] leading-[1.45] font-mono whitespace-pre-wrap break-all",
          )}
        >
          {entries.length === 0
            ? t("diagnosticsLogs.empty")
            : entries.map((entry) => (
                <div key={`${entry.timestamp}-${entry.target}-${entry.message}`}>
                  <span className="text-fg-3">[{entry.timestamp}] </span>
                  <span className={LEVEL_CLASS[entry.level]}>
                    {entry.level.toUpperCase().padEnd(5)}
                  </span>
                  <span className="text-fg-2"> {entry.target}: </span>
                  <span className="text-fg-1">{entry.message}</span>
                </div>
              ))}
        </pre>
      </div>
    </div>
  );
}
