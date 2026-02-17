import type { MoodColorAccent } from "../constants/color-accents";

export interface Mood {
  id: string;
  title: string;
  subtitle: string;
  energyLevel: number;
  tags: string[];
  icon?: string;
  colorAccent?: MoodColorAccent;
  order: number;
}

export type MoodDraft = Omit<Mood, "id" | "order">;
export type MoodUpdate = Partial<Omit<Mood, "id">>;
