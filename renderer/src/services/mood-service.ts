import type { Mood, MoodDraft, MoodUpdate } from "@shared/types/mood";

export const moodService = {
  list: (): Promise<Mood[]> => window.aura.moods.list(),
  create: (draft: MoodDraft): Promise<Mood[]> => window.aura.moods.create(draft),
  update: (id: string, patch: MoodUpdate): Promise<Mood[]> => window.aura.moods.update(id, patch),
  delete: (id: string): Promise<Mood[]> => window.aura.moods.delete(id),
  reorder: (orderedIds: string[]): Promise<Mood[]> => window.aura.moods.reorder(orderedIds),
  exportToJson: () => window.aura.moods.exportToJson(),
  importFromJson: () => window.aura.moods.importFromJson()
};