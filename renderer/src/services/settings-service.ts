import type { AppSettings } from "@shared/types/settings";

export const settingsService = {
  get: (): Promise<AppSettings> => window.aura.settings.get(),
  set: (partial: Partial<AppSettings>): Promise<AppSettings> => window.aura.settings.set(partial)
};