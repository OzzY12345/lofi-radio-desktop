export const MOOD_COLOR_ACCENTS = [
  "teal",
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet",
  "slate",
  "cyan"
] as const;

export type MoodColorAccent = (typeof MOOD_COLOR_ACCENTS)[number];