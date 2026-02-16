import { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TransportCommand, TransportPayload } from "@shared/types/ipc";
import { registerIpcHandlers } from "./ipc/handlers";
import { MoodRepository } from "./storage/mood-repository";
import { SettingsRepository } from "./storage/settings-repository";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const settingsRepo = new SettingsRepository();
const moodRepo = new MoodRepository();

let playbackState: TransportPayload = {
  isPlaying: false,
  moodTitle: undefined
};

const sendTransportCommand = (command: TransportCommand): void => {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send("transport:command", command);
};

const getTrayIcon = (): Electron.NativeImage => {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "build", "icon.ico")
    : path.join(process.cwd(), "build", "icon.ico");

  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? nativeImage.createEmpty() : icon;
};

const showMainWindow = (): void => {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("app:focus");
};

const updateTrayMenu = (): void => {
  if (!tray) {
    return;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: playbackState.isPlaying ? "Pause" : "Play",
      click: () => sendTransportCommand("play-pause")
    },
    {
      label: "Next Mood",
      click: () => sendTransportCommand("next-mood")
    },
    {
      label: "Previous Mood",
      click: () => sendTransportCommand("prev-mood")
    },
    { type: "separator" },
    {
      label: "Open",
      click: () => showMainWindow()
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip(
    playbackState.moodTitle
      ? `AuraFi - ${playbackState.moodTitle}${playbackState.isPlaying ? " (Playing)" : " (Paused)"}`
      : "AuraFi"
  );
  tray.setContextMenu(menu);
};

const requestClose = (): void => {
  const settings = settingsRepo.get();

  if (settings.exitOnClose) {
    isQuitting = true;
    app.quit();
    return;
  }

  if (mainWindow) {
    mainWindow.hide();
  }
};

const applyHotkeys = (): void => {
  globalShortcut.unregisterAll();

  if (!settingsRepo.get().enableGlobalHotkeys) {
    return;
  }

  globalShortcut.register("CommandOrControl+Alt+P", () => sendTransportCommand("play-pause"));
  globalShortcut.register("CommandOrControl+Alt+Right", () => sendTransportCommand("next-mood"));
  globalShortcut.register("CommandOrControl+Alt+Left", () => sendTransportCommand("prev-mood"));
};

const createWindow = (): void => {
  const preload = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    minWidth: 360,
    minHeight: 480,
    autoHideMenuBar: true,
    show: false,
    title: "AuraFi",
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      backgroundThrottling: false
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    const settings = settingsRepo.get();
    if (!settings.exitOnClose) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }

  if (!isDev) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.webContents.on("ipc-message", (_event, channel, payload) => {
    if (channel === "player:state-broadcast") {
      playbackState = payload as TransportPayload;
      updateTrayMenu();
    }
  });
};

const createTray = (): void => {
  tray = new Tray(getTrayIcon());
  tray.on("double-click", () => showMainWindow());
  updateTrayMenu();
};

const bootstrap = async (): Promise<void> => {
  app.setAppUserModelId("com.local.aurafi");

  registerIpcHandlers({
    getWindow: () => mainWindow,
    settingsRepo,
    moodRepo,
    requestClose,
    applyHotkeys
  });

  createWindow();
  createTray();
  applyHotkeys();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }
    showMainWindow();
  });

  app.on("before-quit", () => {
    isQuitting = true;
    globalShortcut.unregisterAll();
    tray?.destroy();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      // Keep app alive in tray on Windows/Linux.
    }
  });
};

app.whenReady().then(() => {
  void bootstrap();
});