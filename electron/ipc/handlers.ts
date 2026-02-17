import { app, dialog, ipcMain, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import type { TransportPayload } from "../../shared/types/audio";
import type { MoodDraft, MoodUpdate } from "../../shared/types/mood";
import { MoodRepository } from "../storage/mood-repository";
import { SettingsRepository } from "../storage/settings-repository";

interface HandlerDeps {
  getWindow: () => BrowserWindow | null;
  settingsRepo: SettingsRepository;
  moodRepo: MoodRepository;
  requestClose: () => void;
  applyHotkeys: () => void;
  onPlayerState: (payload: TransportPayload) => void;
}

export const registerIpcHandlers = ({
  getWindow,
  settingsRepo,
  moodRepo,
  requestClose,
  applyHotkeys,
  onPlayerState
}: HandlerDeps): void => {
  ipcMain.handle("settings:get", () => settingsRepo.get());

  ipcMain.handle("settings:set", (_event, partial) => {
    const next = settingsRepo.set(partial);
    applyHotkeys();
    return next;
  });

  ipcMain.handle("moods:list", () => moodRepo.list());

  ipcMain.handle("moods:create", (_event, draft: MoodDraft) => moodRepo.create(draft));

  ipcMain.handle("moods:update", (_event, id: string, patch: MoodUpdate) => moodRepo.update(id, patch));

  ipcMain.handle("moods:delete", (_event, id: string) => moodRepo.delete(id));

  ipcMain.handle("moods:reorder", (_event, orderedIds: string[]) => moodRepo.reorder(orderedIds));

  ipcMain.handle("moods:export-dialog", async () => {
    const win = getWindow();
    if (!win) {
      return { canceled: true, error: "Window not ready" };
    }

    const result = await dialog.showSaveDialog(win, {
      title: "Export moods",
      defaultPath: "aurafi-moods.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const payload = moodRepo.toExportPayload();
    await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf-8");

    return {
      canceled: false,
      filePath: result.filePath
    };
  });

  ipcMain.handle("moods:import-dialog", async () => {
    const win = getWindow();
    if (!win) {
      return { canceled: true, error: "Window not ready" };
    }

    const result = await dialog.showOpenDialog(win, {
      title: "Import moods",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    try {
      const file = result.filePaths[0];
      const raw = await fs.readFile(file, "utf-8");
      const parsed = JSON.parse(raw);
      const moods = moodRepo.importPayload(parsed);

      return {
        canceled: false,
        moods
      };
    } catch (error) {
      return {
        canceled: false,
        error: error instanceof Error ? error.message : "Import failed"
      };
    }
  });

  ipcMain.handle("window:open", () => {
    const win = getWindow();
    if (!win) {
      return;
    }
    win.show();
    win.focus();
  });

  ipcMain.handle("window:request-close", () => {
    requestClose();
  });

  ipcMain.on("player:state-changed", (_event, payload: TransportPayload) => {
    onPlayerState(payload);
  });

  app.on("before-quit", () => {
    ipcMain.removeHandler("settings:get");
    ipcMain.removeHandler("settings:set");
    ipcMain.removeHandler("moods:list");
    ipcMain.removeHandler("moods:create");
    ipcMain.removeHandler("moods:update");
    ipcMain.removeHandler("moods:delete");
    ipcMain.removeHandler("moods:reorder");
    ipcMain.removeHandler("moods:export-dialog");
    ipcMain.removeHandler("moods:import-dialog");
    ipcMain.removeHandler("window:open");
    ipcMain.removeHandler("window:request-close");
  });
};
