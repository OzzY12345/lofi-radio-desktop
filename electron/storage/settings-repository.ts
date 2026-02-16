import Store from "electron-store";
import type { AppSettings } from "@shared/types/settings";
import { normalizeSettings } from "@shared/utils/validation";

const DEFAULT_SETTINGS: AppSettings = {
  volume: 0.6,
  rememberLastMood: true,
  exitOnClose: false,
  enableGlobalHotkeys: true,
  autoplay: false
};

export class SettingsRepository {
  private readonly store: Store<{ settings: AppSettings }>;

  constructor() {
    this.store = new Store<{ settings: AppSettings }>({
      name: "aurafi",
      defaults: {
        settings: DEFAULT_SETTINGS
      }
    });
  }

  get(): AppSettings {
    return normalizeSettings(this.store.get("settings", DEFAULT_SETTINGS));
  }

  set(partial: Partial<AppSettings>): AppSettings {
    const next = normalizeSettings({ ...this.get(), ...partial });

    if (!next.rememberLastMood) {
      next.lastMoodId = undefined;
    }

    this.store.set("settings", next);
    return next;
  }
}

export const defaultSettings = DEFAULT_SETTINGS;