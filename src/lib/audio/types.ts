export type MicrophonePermission =
  | "granted"
  | "denied"
  | "restricted"
  | "notDetermined"
  | "unknown";

export type AudioSourceKind = "blackhole" | "mic";

export interface AudioInputDevice {
  id: string;
  name: string;
  isDefault: boolean;
  isBlackhole: boolean;
}

export interface AudioEnvironmentStatus {
  microphone: MicrophonePermission;
  blackholeInstalled: boolean;
  inputDevices: AudioInputDevice[];
}

export interface AudioCaptureStatus {
  active: boolean;
  source: AudioSourceKind | null;
  deviceName: string | null;
  sampleRate: number | null;
  channels: number | null;
  chunksEmitted: number;
}

export interface AudioChunkPayload {
  sequence: number;
  sampleRate: number;
  channels: number;
  samples: number[];
}
