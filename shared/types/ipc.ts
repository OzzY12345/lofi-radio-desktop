import type { Mood } from "./mood";
import type { AppSettings } from "./settings";
import type { TransportPayload } from "./audio";

export type TransportCommand = "play-pause" | "next-mood" | "prev-mood" | "open-window";

export interface MoodsExportPayload {
  schemaVersion: 1;
  moods: Mood[];
}

export interface MoodsExportResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
}

export interface MoodsImportResult {
  canceled: boolean;
  moods?: Mood[];
  error?: string;
}

export interface AuraBridge {
  player: {
    notifyState: (payload: TransportPayload) => void;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  };
  moods: {
    list: () => Promise<Mood[]>;
    create: (draft: Omit<Mood, "id" | "order">) => Promise<Mood[]>;
    update: (id: string, patch: Partial<Omit<Mood, "id">>) => Promise<Mood[]>;
    delete: (id: string) => Promise<Mood[]>;
    reorder: (orderedIds: string[]) => Promise<Mood[]>;
    exportToJson: () => Promise<MoodsExportResult>;
    importFromJson: () => Promise<MoodsImportResult>;
  };
  window: {
    open: () => Promise<void>;
    requestClose: () => Promise<void>;
  };
  events: {
    onTransportCommand: (callback: (command: TransportCommand) => void) => () => void;
    onAppFocus: (callback: () => void) => () => void;
  };
}
