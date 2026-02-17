import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AudioEngineState } from "@shared/types/audio";
import type { Mood } from "@shared/types/mood";
import type { AppSettings } from "@shared/types/settings";
import { PlayerScreen } from "./features/player/PlayerScreen";
import { AudioEngine } from "./services/audio-engine";
import { moodService } from "./services/mood-service";
import { settingsService } from "./services/settings-service";
import { InternetRadioSourceProvider } from "./services/source-provider/internet-radio-source-provider";

const defaultSettings: AppSettings = {
  volume: 0.6,
  rememberLastMood: true,
  exitOnClose: false,
  enableGlobalHotkeys: true,
  autoplay: false,
  lastMoodId: undefined
};

const defaultEngineState: AudioEngineState = {
  status: "idle",
  availableSources: [],
  volume: 0.6,
  error: undefined
};

export default function App(): JSX.Element {
  const initializedRef = useRef(false);

  const provider = useMemo(() => new InternetRadioSourceProvider(), []);
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine(provider, defaultSettings.volume);
  }
  const engine = engineRef.current;

  const [moods, setMoods] = useState<Mood[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeMoodId, setActiveMoodId] = useState<string | undefined>();
  const [engineState, setEngineState] = useState<AudioEngineState>(defaultEngineState);
  const [loading, setLoading] = useState(true);
  const [isWindowActive, setIsWindowActive] = useState<boolean>(!document.hidden && document.hasFocus());

  const activeMood = moods.find((mood) => mood.id === activeMoodId);

  const persistLastMood = useCallback(
    async (moodId: string | undefined, baseSettings?: AppSettings) => {
      const source = baseSettings ?? settings;
      if (!moodId || !source.rememberLastMood) {
        return;
      }

      const next = await settingsService.set({ lastMoodId: moodId });
      setSettings(next);
    },
    [settings]
  );

  const selectMood = useCallback(
    async (moodId: string, options?: { saveAsLast?: boolean }) => {
      setActiveMoodId(moodId);
      await engine.setMood(moodId);

      if (options?.saveAsLast !== false) {
        await persistLastMood(moodId);
      }
    },
    [engine, persistLastMood]
  );

  const handleSettingChange = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = await settingsService.set(partial);
      setSettings(next);

      if (typeof partial.volume === "number") {
        engine.setVolume(next.volume);
      }
    },
    [engine]
  );

  const handleVolumeChange = useCallback(
    async (volume: number) => {
      engine.setVolume(volume);
      await handleSettingChange({ volume });
    },
    [engine, handleSettingChange]
  );

  const handlePlayPause = useCallback(async () => {
    if (engineState.status === "playing") {
      await engine.pause();
      return;
    }

    if (!activeMoodId && moods[0]) {
      await selectMood(moods[0].id);
    }

    await engine.play();
  }, [engine, engineState.status, activeMoodId, moods, selectMood]);

  const handleNextMood = useCallback(async () => {
    const isFocusQueue = activeMoodId === "focus" && engine.getState().currentSource?.kind === "embed";
    if (isFocusQueue) {
      await engine.nextSourceInQueue();
      return;
    }

    if (!moods.length) {
      return;
    }

    const index = moods.findIndex((mood) => mood.id === activeMoodId);
    const nextIndex = index < 0 ? 0 : (index + 1) % moods.length;
    await selectMood(moods[nextIndex].id);
  }, [moods, activeMoodId, selectMood]);

  const handlePrevMood = useCallback(async () => {
    const isFocusQueue = activeMoodId === "focus" && engine.getState().currentSource?.kind === "embed";
    if (isFocusQueue) {
      await engine.prevSourceInQueue();
      return;
    }

    if (!moods.length) {
      return;
    }

    const index = moods.findIndex((mood) => mood.id === activeMoodId);
    const prevIndex = index < 0 ? 0 : (index - 1 + moods.length) % moods.length;
    await selectMood(moods[prevIndex].id);
  }, [moods, activeMoodId, selectMood]);

  const handleRetry = useCallback(async () => {
    await engine.retry();
  }, [engine]);

  const handleNextTrack = useCallback(async () => {
    await engine.nextSourceInQueue();
  }, [engine]);

  const handlePrevTrack = useCallback(async () => {
    await engine.prevSourceInQueue();
  }, [engine]);

  useEffect(() => {
    const unsubscribe = engine.subscribe((state) => {
      setEngineState(state);
    });

    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const bootstrap = async () => {
      const [nextSettings, nextMoods] = await Promise.all([settingsService.get(), moodService.list()]);
      setSettings(nextSettings);
      setMoods(nextMoods);
      engine.setVolume(nextSettings.volume);

      if (nextMoods.length > 0) {
        const preferred = nextSettings.rememberLastMood
          ? nextMoods.find((mood) => mood.id === nextSettings.lastMoodId)
          : undefined;

        const initialMood = preferred ?? nextMoods[0];
        setActiveMoodId(initialMood.id);
        await engine.setMood(initialMood.id);

        if (nextSettings.autoplay) {
          await engine.play();
        }
      }

      setLoading(false);
    };

    void bootstrap();
  }, [engine]);

  useEffect(() => {
    const unsubscribeTransport = window.aura.events.onTransportCommand((command) => {
      if (command === "play-pause") {
        void handlePlayPause();
        return;
      }
      if (command === "next-mood") {
        void handleNextMood();
        return;
      }
      if (command === "prev-mood") {
        void handlePrevMood();
      }
    });

    const unsubscribeFocus = window.aura.events.onAppFocus(() => {
      setIsWindowActive(true);
    });

    const syncWindowActivity = () => {
      setIsWindowActive(!document.hidden && document.hasFocus());
    };

    document.addEventListener("visibilitychange", syncWindowActivity);
    window.addEventListener("focus", syncWindowActivity);
    window.addEventListener("blur", syncWindowActivity);

    const onKeyDown = (event: KeyboardEvent) => {
      const isCtrlW = event.ctrlKey && event.key.toLowerCase() === "w";
      if (event.key === "Escape" || isCtrlW) {
        event.preventDefault();
        void window.aura.window.requestClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      unsubscribeTransport();
      unsubscribeFocus();
      document.removeEventListener("visibilitychange", syncWindowActivity);
      window.removeEventListener("focus", syncWindowActivity);
      window.removeEventListener("blur", syncWindowActivity);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleNextMood, handlePlayPause, handlePrevMood]);

  useEffect(() => {
    window.aura.player.notifyState({
      isPlaying: engineState.status === "playing",
      moodTitle: activeMood?.title
    });
  }, [engineState.status, activeMood?.title]);

  if (loading) {
    return (
      <main className="app-shell">
        <div className="panel">Loading...</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>AEGA Radio</h1>
          <div className="muted small">Background mood music, minimal mode</div>
        </div>
      </header>
      <PlayerScreen
        moods={moods}
        activeMoodId={activeMoodId}
        engineState={engineState}
        settings={settings}
        isMotionActive={isWindowActive}
        onSelectMood={async (id) => {
          await selectMood(id);
        }}
        onPlayPause={handlePlayPause}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onVolumeChange={handleVolumeChange}
        onRetry={handleRetry}
      />
    </main>
  );
}
