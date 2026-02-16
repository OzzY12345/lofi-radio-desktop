import { MOOD_COLOR_ACCENTS, type MoodColorAccent } from "@shared/constants/color-accents";
import type { Mood, MoodDraft, MoodUpdate } from "@shared/types/mood";
import type { AppSettings } from "@shared/types/settings";

export const clamp01 = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

export const normalizeTags = (tags: string[] | string): string[] => {
  const raw = Array.isArray(tags) ? tags : tags.split(",");
  const normalized = raw
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.toLowerCase());

  return Array.from(new Set(normalized));
};

export const normalizeAccent = (accent?: string): MoodColorAccent | undefined => {
  if (!accent) {
    return undefined;
  }
  if (MOOD_COLOR_ACCENTS.includes(accent as MoodColorAccent)) {
    return accent as MoodColorAccent;
  }
  return undefined;
};

export const normalizeMoodDraft = (draft: MoodDraft): MoodDraft => {
  return {
    title: draft.title.trim() || "Untitled",
    subtitle: draft.subtitle.trim(),
    energyLevel: clamp01(Number(draft.energyLevel ?? 0.5)),
    tags: normalizeTags(draft.tags),
    icon: draft.icon?.trim() || undefined,
    colorAccent: normalizeAccent(draft.colorAccent)
  };
};

export const normalizeMoodPatch = (patch: MoodUpdate): MoodUpdate => {
  const next: MoodUpdate = { ...patch };

  if (typeof patch.title === "string") {
    next.title = patch.title.trim() || "Untitled";
  }

  if (typeof patch.subtitle === "string") {
    next.subtitle = patch.subtitle.trim();
  }

  if (typeof patch.energyLevel === "number") {
    next.energyLevel = clamp01(Number(patch.energyLevel));
  }

  if (patch.tags) {
    next.tags = normalizeTags(patch.tags);
  }

  if (typeof patch.icon === "string") {
    next.icon = patch.icon.trim() || undefined;
  }

  if (typeof patch.colorAccent !== "undefined") {
    next.colorAccent = normalizeAccent(patch.colorAccent);
  }

  return next;
};

export const normalizeMood = (mood: Mood, order: number): Mood => {
  return {
    ...mood,
    title: mood.title.trim() || "Untitled",
    subtitle: (mood.subtitle ?? "").trim(),
    energyLevel: clamp01(Number(mood.energyLevel ?? 0.5)),
    tags: normalizeTags(mood.tags ?? []),
    icon: mood.icon?.trim() || undefined,
    colorAccent: normalizeAccent(mood.colorAccent),
    order
  };
};

export const normalizeSettings = (settings: AppSettings): AppSettings => {
  return {
    volume: clamp01(Number(settings.volume ?? 0.6)),
    rememberLastMood: Boolean(settings.rememberLastMood),
    exitOnClose: Boolean(settings.exitOnClose),
    enableGlobalHotkeys: Boolean(settings.enableGlobalHotkeys),
    autoplay: Boolean(settings.autoplay),
    lastMoodId: settings.lastMoodId
  };
};