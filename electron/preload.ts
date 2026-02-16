import { contextBridge, ipcRenderer } from "electron";
import type { AuraBridge, TransportCommand } from "@shared/types/ipc";
import type { TransportPayload } from "@shared/types/audio";

const api: AuraBridge = {
  player: {
    notifyState: (payload: TransportPayload) => {
      ipcRenderer.send("player:state-changed", payload);
    }
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial) => ipcRenderer.invoke("settings:set", partial)
  },
  moods: {
    list: () => ipcRenderer.invoke("moods:list"),
    create: (draft) => ipcRenderer.invoke("moods:create", draft),
    update: (id, patch) => ipcRenderer.invoke("moods:update", id, patch),
    delete: (id) => ipcRenderer.invoke("moods:delete", id),
    reorder: (orderedIds) => ipcRenderer.invoke("moods:reorder", orderedIds),
    exportToJson: () => ipcRenderer.invoke("moods:export-dialog"),
    importFromJson: () => ipcRenderer.invoke("moods:import-dialog")
  },
  window: {
    open: () => ipcRenderer.invoke("window:open"),
    requestClose: () => ipcRenderer.invoke("window:request-close")
  },
  events: {
    onTransportCommand: (callback: (command: TransportCommand) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: TransportCommand) => {
        callback(command);
      };

      ipcRenderer.on("transport:command", listener);
      return () => {
        ipcRenderer.removeListener("transport:command", listener);
      };
    },
    onAppFocus: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("app:focus", listener);
      return () => {
        ipcRenderer.removeListener("app:focus", listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld("aura", api);