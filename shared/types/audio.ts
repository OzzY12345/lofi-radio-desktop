import type { AudioSource } from "@shared/types/source";

export type AudioEngineStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioEngineState {
  status: AudioEngineStatus;
  currentMoodId?: string;
  currentSource?: AudioSource;
  availableSources: AudioSource[];
  volume: number;
  error?: string;
}

export interface TransportPayload {
  isPlaying: boolean;
  moodTitle?: string;
}