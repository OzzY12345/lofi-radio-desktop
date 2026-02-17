# AEGA Radio (Electron + React + TypeScript)

Minimal personal Windows desktop app for mood-based internet radio.

## Stack
- Electron (main/tray/hotkeys/lifecycle)
- React + Vite (renderer UI)
- TypeScript
- Storage: `electron-store` via repository layer
- Packaging: `electron-builder` (NSIS)

## Features (MVP)
- Tray-first behavior (close to tray by default)
- Tray menu: Play/Pause, Next Mood, Previous Mood, Open, Quit
- Global hotkeys:
  - `Ctrl+Alt+P` Play/Pause
  - `Ctrl+Alt+Right` Next mood
  - `Ctrl+Alt+Left` Previous mood
- Player screen:
  - current mood
  - play/pause
  - volume
  - station auto-selected by chosen mood
  - retry on source error
- Defaults on first run:
  - Jazz, Energy, Paradise, Deep Focus
- Audio engine in renderer (`HTMLAudioElement`) with fade transitions
- `Deep Focus` uses a SoundCloud queue (7 tracks, sequential loop)

## Project Structure
- `electron/` main process, preload, IPC, repositories
- `renderer/` React UI
- `shared/` types/constants/validation
- `build/icon.ico` app/installer icon

## Install
```powershell
npm install
```

## Run (DEV)
```powershell
npm run dev
```

## Build Windows Installer (.exe)
```powershell
npm run build
```

Artifacts:
- installer and unpacked app: `release/`

## Runtime Behavior
- `X`, `Esc`, `Ctrl+W` use the same close path
- `Exit on close = false` (default): app hides to tray
- `Exit on close = true`: app quits
- DevTools disabled in production

## Mood Storage
Data is stored in appData via `electron-store` with key groups:
- `settings`
- `moods`
- `meta.defaultsInitialized`

Typical Windows location:
- `%APPDATA%\\aega-radio\\config.json` (dev/prod may differ by app name)
- Actual base path is Electron `app.getPath('userData')`

The app now uses a fixed personal mood list and station mapping in code.

## Where to Edit UI
- App shell and orchestration: `renderer/src/App.tsx`
- Player screen: `renderer/src/features/player/PlayerScreen.tsx`
- Theme/styles: `renderer/src/styles.css`

## Where to Change Icon
- Replace `build/icon.ico`
- Rebuild installer with `npm run build`

## Audio Source Provider Abstraction
Current provider:
- `renderer/src/services/source-provider/internet-radio-source-provider.ts`
- Mood-to-stations catalog: `renderer/src/services/source-provider/internet-radio-catalog.ts`

Interface:
- `AudioSourceProvider.listSourcesForMood(moodId): Promise<AudioSource[]>`
- `AudioSource = { id, label, kind, uri }`

Current behavior:
- Stations are selected automatically from mood
- Mood IDs are fixed (`jazz`, `energy`, `paradise`, `focus`) and mapped to curated internet radio / embed lists

## Deep Focus SoundCloud Queue
- `Deep Focus` (id: `focus`) uses SoundCloud Widget API in renderer.
- 7 tracks are loaded as `embed` sources and play in order.
- After the last track, playback loops back to track 1.
- If SoundCloud source is unavailable, player state switches to `error` and UI shows `Retry`.

To add real providers later:
1. Create new provider implementing `AudioSourceProvider`
2. Replace provider creation in `renderer/src/App.tsx`
3. Keep `AudioEngine` API unchanged
