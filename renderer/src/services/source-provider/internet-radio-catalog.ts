import type { AudioSource } from "@shared/types/source";

type MoodKey = "jazz" | "energy" | "paradise" | "focus" | "sad" | "deep-house" | "liquid-dnb";

const toLocalAssetUri = (absolutePath: string): string => {
  const normalized = absolutePath.replace(/\\/g, "/");
  return `/__local__/${encodeURIComponent(normalized)}`;
};

const toBundledAssetUri = (relativePath: string): string => {
  const normalized = relativePath.replace(/\\/g, "/");
  return `/__assets__/${encodeURI(normalized)}`;
};

const STATIONS_BY_MOOD: Record<MoodKey, Array<{ label: string; uri: string }>> = {
  jazz: [
    { label: "Radio Swiss Jazz", uri: "https://stream.srg-ssr.ch/srgssr/rsj/mp3/128" }
  ],
  energy: [
    { label: "KEXP", uri: "https://kexp.streamguys1.com/kexp160.aac" }
  ],
  paradise: [
    { label: "Radio Paradise", uri: "http://stream-dc1.radioparadise.com/mp3-192" }
  ],
  focus: [
    {
      label: "Idea 22",
      uri: "https://soundcloud.com/mythostempest/idea-22-but-it-sounds-like"
    },
    {
      label: "Losing (Slowed)",
      uri: "https://soundcloud.com/lon_nex/losing-slowed-down"
    },
    {
      label: "Bleak Midwinter (1 Hour)",
      uri: "https://soundcloud.com/youmadethis/in-the-bleak-midwinter-slowed-1-hour"
    },
    {
      label: "Where Do We Go (Loop)",
      uri: "https://soundcloud.com/tekkecore/wheredowego-intro-11min-loop"
    },
    {
      label: "Everything In Its Right Place",
      uri: "https://soundcloud.com/akame-assassin/radiohead-everything-in-its"
    },
    {
      label: "Sage",
      uri: "https://soundcloud.com/user-396074918/sage"
    },
    {
      label: "TXMY Ethereal (Slowed)",
      uri: "https://soundcloud.com/mydigjjwzajt/txmy-ethereal-slowed-to"
    }
  ],
  sad: [
    {
      label: "pretty feelings",
      uri: toLocalAssetUri("D:/Downloads/SadTracks/pretty_feelings.mp3")
    },
    {
      label: "still feel ur pain shoegaze dreampop",
      uri: toLocalAssetUri("D:/Downloads/SadTracks/still_feel_ur_pain_shoegaze_dreampop.mp3")
    }
  ],
  "deep-house": [
    {
      label: "aesthetic deep house mix",
      uri: toLocalAssetUri("D:/Downloads/DeepHouse/aesthetic_deep_house_mix.mp3")
    },
    {
      label: "Ambient Lo-Fi House Playlist",
      uri: toLocalAssetUri("D:/Downloads/DeepHouse/Ambient_Lo-Fi_House_Playlist.mp3")
    },
    {
      label: "deep ambient house playlist",
      uri: toLocalAssetUri("D:/Downloads/DeepHouse/deep_ambient_house_playlist.mp3")
    },
    {
      label: "Lofi Deep House and Garage - 2025 House Mix",
      uri: toLocalAssetUri("D:/Downloads/DeepHouse/Lofi_Deep_House_and_Garage_-_2025_House_Mix.mp3")
    },
    {
      label: "Lo-Fi House - A Deep Melancholy Mix for Goth Babes Solitude",
      uri: toLocalAssetUri("D:/Downloads/DeepHouse/Lo-Fi_House_-_A_Deep_Melancholy_Mix_for_Goth_Babes_Solitude.mp3")
    }
  ],
  "liquid-dnb": [
    {
      label: "2005.EXE Liquid DnB Jungle Mix",
      uri: toBundledAssetUri("audio/liquid_dnb_jungle_mix.m4a")
    }
  ]
};

const moodOrder: MoodKey[] = ["jazz", "energy", "paradise", "focus", "sad", "deep-house", "liquid-dnb"];

const resolveMoodKey = (moodId: string): MoodKey => {
  const candidate = moodId.trim().toLowerCase() as MoodKey;
  if (candidate in STATIONS_BY_MOOD) {
    return candidate;
  }
  return "focus";
};

export const getStationsForMood = (moodId: string): AudioSource[] => {
  const moodKey = resolveMoodKey(moodId);
  const stations = STATIONS_BY_MOOD[moodKey];
  const sourceKind =
    moodKey === "sad" || moodKey === "deep-house" || moodKey === "liquid-dnb"
      ? "local"
      : moodKey === "focus"
        ? "embed"
        : "stream";

  return stations.map((station, index) => ({
    id: `${moodKey}-station-${index + 1}`,
    label: station.label,
    kind: sourceKind,
    uri: station.uri
  }));
};

export const getMoodOrder = (): MoodKey[] => {
  return [...moodOrder];
};
