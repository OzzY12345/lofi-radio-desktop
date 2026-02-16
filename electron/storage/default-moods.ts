import { randomUUID } from "node:crypto";
import type { Mood } from "@shared/types/mood";

interface SeedMood {
  title: string;
  subtitle: string;
  energyLevel: number;
  tags: string[];
  icon?: string;
  colorAccent?: Mood["colorAccent"];
}

const SEED_MOODS: SeedMood[] = [
  {
    title: "Focus",
    subtitle: "Deep concentration",
    energyLevel: 0.65,
    tags: ["focus", "flow", "work"],
    icon: "??",
    colorAccent: "teal"
  },
  {
    title: "Chill",
    subtitle: "Light and calm",
    energyLevel: 0.35,
    tags: ["chill", "downtempo"],
    icon: "??",
    colorAccent: "blue"
  },
  {
    title: "Relax",
    subtitle: "Slow breathing",
    energyLevel: 0.25,
    tags: ["relax", "ambient"],
    icon: "??",
    colorAccent: "emerald"
  },
  {
    title: "Sleep",
    subtitle: "Night mode",
    energyLevel: 0.1,
    tags: ["sleep", "night"],
    icon: "??",
    colorAccent: "violet"
  },
  {
    title: "Rainy",
    subtitle: "Rain and lo-fi",
    energyLevel: 0.3,
    tags: ["rain", "study"],
    icon: "???",
    colorAccent: "cyan"
  },
  {
    title: "Deep Work",
    subtitle: "No distraction",
    energyLevel: 0.75,
    tags: ["deep", "productivity"],
    icon: "??",
    colorAccent: "amber"
  },
  {
    title: "Cozy",
    subtitle: "Warm background",
    energyLevel: 0.4,
    tags: ["cozy", "warm"],
    icon: "?",
    colorAccent: "rose"
  }
];

export const createDefaultMoods = (): Mood[] => {
  return SEED_MOODS.map((mood, index) => ({
    id: randomUUID(),
    title: mood.title,
    subtitle: mood.subtitle,
    energyLevel: mood.energyLevel,
    tags: mood.tags,
    icon: mood.icon,
    colorAccent: mood.colorAccent,
    order: index
  }));
};