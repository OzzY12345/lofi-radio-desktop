import { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage } from "electron";
import { createServer, type Server } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TransportPayload } from "../shared/types/audio";
import type { TransportCommand } from "../shared/types/ipc";
import { registerIpcHandlers } from "./ipc/handlers";
import { MoodRepository } from "./storage/mood-repository";
import { SettingsRepository } from "./storage/settings-repository";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const PREFERRED_RENDERER_PORT = 32145;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let rendererServer: Server | null = null;
let rendererServerUrl: string | null = null;
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
    ? path.join(process.resourcesPath, "app.asar", "build", "icon.ico")
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
      ? `AEGA Radio - ${playbackState.moodTitle}${playbackState.isPlaying ? " (Playing)" : " (Paused)"}`
      : "AEGA Radio"
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

const mimeByExt: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac"
};

const startRendererServer = async (): Promise<string> => {
  const appRoot = path.join(__dirname, "..");
  const rendererRoot = path.join(__dirname, "../dist/renderer");
  const fallbackHtml = path.join(rendererRoot, "index.html");
  const bundledAssetsRoot = path.join(appRoot, "assets");
  const localAudioRoots = [
    path.normalize("D:/Downloads/SadTracks"),
    path.normalize("D:/Downloads/DeepHouse")
  ];
  const allowedAudioExt = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac"]);

  const server = createServer((req, res) => {
    const reqUrl = req.url ?? "/";
    const pathname = reqUrl.split("?")[0];

    if (pathname.startsWith("/__local__/")) {
      const encodedPath = pathname.slice("/__local__/".length);
      const decodedPath = decodeURIComponent(encodedPath);
      const normalizedPath = path.normalize(decodedPath);
      const ext = path.extname(normalizedPath).toLowerCase();
      const insideAllowedRoot = localAudioRoots.some((root) => normalizedPath.startsWith(root));

      if (!insideAllowedRoot || !allowedAudioExt.has(ext) || !existsSync(normalizedPath)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const contentType = mimeByExt[ext] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
      createReadStream(normalizedPath).pipe(res);
      return;
    }

    if (pathname.startsWith("/__assets__/")) {
      const assetRelativePath = decodeURIComponent(pathname.slice("/__assets__/".length));
      const normalizedAssetPath = path.normalize(path.join(bundledAssetsRoot, assetRelativePath));
      const ext = path.extname(normalizedAssetPath).toLowerCase();
      const insideAssetsRoot = normalizedAssetPath.startsWith(bundledAssetsRoot);

      if (!insideAssetsRoot || !allowedAudioExt.has(ext) || !existsSync(normalizedAssetPath)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const contentType = mimeByExt[ext] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
      createReadStream(normalizedAssetPath).pipe(res);
      return;
    }

    const safePath = pathname === "/" ? "/index.html" : pathname;
    const candidate = path.normalize(path.join(rendererRoot, safePath));
    const insideRoot = candidate.startsWith(rendererRoot);
    const filePath = insideRoot && existsSync(candidate) ? candidate : fallbackHtml;

    if (!existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeByExt[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
    createReadStream(filePath).pipe(res);
  });

  const listenServer = (port: number): Promise<void> =>
    new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });

  try {
    await listenServer(PREFERRED_RENDERER_PORT);
  } catch {
    await listenServer(0);
  }

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to start renderer server");
  }

  rendererServer = server;
  return `http://127.0.0.1:${address.port}`;
};

const createWindow = (): void => {
  const preload = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 440,
    height: 760,
    minWidth: 420,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    title: "AEGA Radio",
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
  } else if (rendererServerUrl) {
    mainWindow.loadURL(rendererServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }

  if (!isDev) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }
};

const createTray = (): void => {
  tray = new Tray(getTrayIcon());
  tray.on("double-click", () => showMainWindow());
  updateTrayMenu();
};

const bootstrap = async (): Promise<void> => {
  app.setAppUserModelId("com.local.aegaradio");

  if (!isDev) {
    rendererServerUrl = await startRendererServer();
  }

  registerIpcHandlers({
    getWindow: () => mainWindow,
    settingsRepo,
    moodRepo,
    requestClose,
    applyHotkeys,
    onPlayerState: (payload) => {
      playbackState = payload;
      updateTrayMenu();
    }
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
    rendererServer?.close();
    rendererServer = null;
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
