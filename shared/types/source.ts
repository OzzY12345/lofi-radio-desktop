export type AudioSourceKind = "stream" | "local" | "embed";

export interface AudioSource {
  id: string;
  label: string;
  kind: AudioSourceKind;
  uri: string;
}

export interface AudioSourceProvider {
  listSourcesForMood(moodId: string): Promise<AudioSource[]>;
}