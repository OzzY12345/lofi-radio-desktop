import type { AudioSource, AudioSourceProvider } from "@shared/types/source";

const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export class MockSourceProvider implements AudioSourceProvider {
  async listSourcesForMood(moodId: string): Promise<AudioSource[]> {
    const slug = slugify(moodId);

    const placeholders: AudioSource[] = [
      {
        id: `${slug}-stream-1`,
        label: "Placeholder stream #1",
        kind: "stream",
        uri: `https://example.com/stream/${slug}-1`
      },
      {
        id: `${slug}-stream-2`,
        label: "Placeholder stream #2",
        kind: "stream",
        uri: `https://example.com/stream/${slug}-2`
      },
      {
        id: `${slug}-stream-3`,
        label: "Placeholder stream #3",
        kind: "stream",
        uri: `https://example.com/stream/${slug}-3`
      }
    ];

    if (import.meta.env.DEV) {
      return [
        {
          id: `${slug}-local-dev`,
          label: "Local test audio",
          kind: "local",
          uri: "/audio/dev-test.mp3"
        },
        ...placeholders
      ];
    }

    return placeholders;
  }
}