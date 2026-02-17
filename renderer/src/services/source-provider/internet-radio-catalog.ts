import type { AudioSource } from "@shared/types/source";

type MoodKey = "jazz" | "energy" | "paradise" | "focus";

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
  ]
};

const moodOrder: MoodKey[] = ["jazz", "energy", "paradise", "focus"];

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
  const sourceKind = moodKey === "focus" ? "embed" : "stream";

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
