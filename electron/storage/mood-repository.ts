import { randomUUID } from "node:crypto";
import Store from "electron-store";
import type { Mood, MoodDraft, MoodUpdate } from "@shared/types/mood";
import type { MoodsExportPayload } from "@shared/types/ipc";
import { normalizeMood, normalizeMoodDraft, normalizeMoodPatch } from "@shared/utils/validation";
import { createDefaultMoods } from "./default-moods";

interface MoodStoreShape {
  moods: Mood[];
  meta: {
    defaultsInitialized: boolean;
  };
}

export class MoodRepository {
  private readonly store: Store<MoodStoreShape>;

  constructor() {
    this.store = new Store<MoodStoreShape>({
      name: "aurafi",
      defaults: {
        moods: [],
        meta: {
          defaultsInitialized: false
        }
      }
    });

    this.ensureDefaults();
  }

  private ensureDefaults(): void {
    const meta = this.store.get("meta");
    const moods = this.store.get("moods");

    if (!meta.defaultsInitialized || moods.length === 0) {
      this.store.set("moods", createDefaultMoods());
      this.store.set("meta.defaultsInitialized", true);
    }
  }

  private write(moods: Mood[]): Mood[] {
    const normalized = moods
      .sort((a, b) => a.order - b.order)
      .map((mood, index) => normalizeMood(mood, index));

    this.store.set("moods", normalized);
    return normalized;
  }

  list(): Mood[] {
    return this.store
      .get("moods", [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((mood, index) => normalizeMood(mood, index));
  }

  create(draft: MoodDraft): Mood[] {
    const base = normalizeMoodDraft(draft);
    const moods = this.list();

    moods.push({
      id: randomUUID(),
      title: base.title,
      subtitle: base.subtitle,
      energyLevel: base.energyLevel,
      tags: base.tags,
      icon: base.icon,
      colorAccent: base.colorAccent,
      order: moods.length
    });

    return this.write(moods);
  }

  update(id: string, patch: MoodUpdate): Mood[] {
    const moods = this.list();
    const normalizedPatch = normalizeMoodPatch(patch);
    const targetIndex = moods.findIndex((item) => item.id === id);

    if (targetIndex === -1) {
      return moods;
    }

    moods[targetIndex] = normalizeMood(
      {
        ...moods[targetIndex],
        ...normalizedPatch
      },
      moods[targetIndex].order
    );

    return this.write(moods);
  }

  delete(id: string): Mood[] {
    const moods = this.list().filter((item) => item.id !== id);
    return this.write(moods);
  }

  reorder(orderedIds: string[]): Mood[] {
    const current = this.list();
    const byId = new Map(current.map((mood) => [mood.id, mood]));

    const reordered: Mood[] = [];

    for (const id of orderedIds) {
      const mood = byId.get(id);
      if (mood) {
        reordered.push(mood);
        byId.delete(id);
      }
    }

    for (const mood of byId.values()) {
      reordered.push(mood);
    }

    return this.write(reordered);
  }

  toExportPayload(): MoodsExportPayload {
    return {
      schemaVersion: 1,
      moods: this.list()
    };
  }

  importPayload(raw: unknown): Mood[] {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid import payload");
    }

    const asPayload = raw as Partial<MoodsExportPayload>;
    if (asPayload.schemaVersion !== 1 || !Array.isArray(asPayload.moods)) {
      throw new Error("Unsupported JSON format");
    }

    const normalized = asPayload.moods
      .map((mood, index) => {
        if (!mood.id || !mood.title) {
          throw new Error("Mood id/title is required");
        }

        return normalizeMood(
          {
            id: mood.id,
            title: mood.title,
            subtitle: mood.subtitle ?? "",
            energyLevel: mood.energyLevel ?? 0.5,
            tags: mood.tags ?? [],
            icon: mood.icon,
            colorAccent: mood.colorAccent,
            order: index
          },
          index
        );
      })
      .map((mood, index) => ({
        ...mood,
        id: mood.id || randomUUID(),
        order: index
      }));

    if (normalized.length === 0) {
      throw new Error("At least one mood is required");
    }

    return this.write(normalized);
  }
}