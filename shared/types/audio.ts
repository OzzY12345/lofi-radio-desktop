import type { AudioSource } from "./source";

export type AudioEngineStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioEngineState {
  status: AudioEngineStatus;
  currentMoodId?: string;
  currentSource?: AudioSource;
  availableSources: AudioSource[];
  currentTrackIndex?: number;
  queueLength?: number;
  volume: number;
  error?: string;
}

export interface TransportPayload {
  isPlaying: boolean;
  moodTitle?: string;
}
