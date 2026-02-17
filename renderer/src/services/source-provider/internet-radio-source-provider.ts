import type { AudioSource, AudioSourceProvider } from "@shared/types/source";
import { getStationsForMood } from "./internet-radio-catalog";

export class InternetRadioSourceProvider implements AudioSourceProvider {
  async listSourcesForMood(moodId: string): Promise<AudioSource[]> {
    return getStationsForMood(moodId);
  }
}
