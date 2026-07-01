import { invoke } from "@tauri-apps/api/core";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  target: string;
  message: string;
}

export async function getRecentLogs(
  limit = 500,
  minLevel?: LogLevel,
): Promise<LogEntry[]> {
  return invoke<LogEntry[]>("get_recent_logs", {
    limit,
    minLevel: minLevel ?? null,
  });
}

export async function getLogFilePath(): Promise<string | null> {
  return invoke<string | null>("get_log_file_path");
}

export async function clearRecentLogs(): Promise<void> {
  await invoke("clear_recent_logs");
}

export function formatLogEntry(entry: LogEntry): string {
  const level = entry.level.toUpperCase().padEnd(5);
  return `[${entry.timestamp}] ${level} ${entry.target}: ${entry.message}`;
}

export function formatLogLines(entries: LogEntry[]): string {
  return entries.map(formatLogEntry).join("\n");
}
