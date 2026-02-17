import type { Mood } from "../../shared/types/mood";

interface SeedMood {
  id: string;
  title: string;
  subtitle: string;
  energyLevel: number;
  tags: string[];
  icon?: string;
  colorAccent?: Mood["colorAccent"];
}

const SEED_MOODS: SeedMood[] = [
  {
    id: "jazz",
    title: "Jazz",
    subtitle: "Light and calm",
    energyLevel: 0.35,
    tags: ["jazz", "smooth", "chill"],
    icon: "\uD83C\uDF19",
    colorAccent: "blue"
  },
  {
    id: "energy",
    title: "Energy",
    subtitle: "High tempo boost",
    energyLevel: 0.9,
    tags: ["energy", "upbeat", "boost"],
    icon: "\u26A1",
    colorAccent: "amber"
  },
  {
    id: "paradise",
    title: "Paradise",
    subtitle: "No distraction",
    energyLevel: 0.75,
    tags: ["paradise", "deep", "ambient"],
    icon: "\uD83E\uDDE0",
    colorAccent: "teal"
  },
  {
    id: "focus",
    title: "Deep Focus",
    subtitle: "Deep concentration",
    energyLevel: 0.65,
    tags: ["focus", "flow", "work"],
    icon: "\uD83C\uDF19",
    colorAccent: "teal"
  }
];

export const createDefaultMoods = (): Mood[] => {
  return SEED_MOODS.map((mood, index) => ({
    id: mood.id,
    title: mood.title,
    subtitle: mood.subtitle,
    energyLevel: mood.energyLevel,
    tags: mood.tags,
    icon: mood.icon,
    colorAccent: mood.colorAccent,
    order: index
  }));
};
