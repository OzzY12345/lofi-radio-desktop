import React, { useEffect, useState } from "react";
import type { AudioEngineState } from "@shared/types/audio";
import type { Mood } from "@shared/types/mood";
import type { AppSettings } from "@shared/types/settings";

interface PlayerScreenProps {
  moods: Mood[];
  activeMoodId?: string;
  engineState: AudioEngineState;
  settings: AppSettings;
  isMotionActive: boolean;
  onSelectMood: (id: string) => Promise<void>;
  onPlayPause: () => Promise<void>;
  onPrevTrack: () => Promise<void>;
  onNextTrack: () => Promise<void>;
  onVolumeChange: (value: number) => Promise<void>;
  onRetry: () => Promise<void>;
}

const statusTitle = (status: AudioEngineState["status"]): string => {
  if (status === "playing") return "LIVE";
  if (status === "paused") return "PAUSED";
  if (status === "loading") return "LOADING";
  if (status === "error") return "ERROR";
  return "IDLE";
};

const renderBars = (): JSX.Element[] => {
  const heights = [22, 14, 26, 12, 20, 16, 24, 13, 19, 15, 23, 11];
  return heights.map((height, index) => (
    <span
      key={`bar-${index}`}
      style={{ height: `${height}px`, animationDelay: `${(index % 6) * 0.12}s` }}
      className="wave-bar"
    />
  ));
};

export function PlayerScreen({
  moods,
  activeMoodId,
  engineState,
  settings,
  isMotionActive,
  onSelectMood,
  onPlayPause,
  onPrevTrack,
  onNextTrack,
  onVolumeChange,
  onRetry
}: PlayerScreenProps): JSX.Element {
  const activeMood = moods.find((mood) => mood.id === activeMoodId);
  const isPlaying = engineState.status === "playing";
  const isDeepFocus = activeMoodId === "focus";
  const stationLabel = engineState.currentSource?.label ?? "Station is loading...";
  const shouldAnimate = isMotionActive && isPlaying;
  const [visibleError, setVisibleError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!engineState.error) {
      setVisibleError(undefined);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleError(engineState.error);
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [engineState.error]);

  return (
    <div className={`neo-shell ${shouldAnimate ? "motion-on" : "motion-off"}`}>
      <section className="mood-pills" aria-label="Mood selector">
        {moods.map((mood) => {
          const active = mood.id === activeMoodId;
          return (
            <button
              key={mood.id}
              type="button"
              className={`mood-pill ${active ? "active" : ""}`}
              onClick={() => void onSelectMood(mood.id)}
            >
              {mood.icon ? `${mood.icon} ` : ""}
              {mood.title}
            </button>
          );
        })}
      </section>

      <section className="player-card">
        <div className="vinyl-wrap" aria-hidden="true">
          <div className="vinyl-stage">
            <div className="vinyl-shadow" />
            <div className="vinyl-record">
              <div className="vinyl-center" />
            </div>
          </div>
        </div>

        <div className="track-panel">
          <h2 className="track-title">{stationLabel}</h2>
          <div className="track-meta-row">
            <span className={`live-dot ${isPlaying ? "on" : ""}`} />
            <span className="track-status">{statusTitle(engineState.status)}</span>
          </div>
          <div className="track-tags">{activeMood?.tags.join(" | ") || "radio"}</div>
        </div>

        <div className="transport-row">
          {isDeepFocus ? (
            <button type="button" className="track-nav-button" onClick={() => void onPrevTrack()}>
              &larr;
            </button>
          ) : null}
          <button type="button" className="play-button" onClick={() => void onPlayPause()}>
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>
          {isDeepFocus ? (
            <button type="button" className="track-nav-button" onClick={() => void onNextTrack()}>
              &rarr;
            </button>
          ) : null}
        </div>

        <div className="wave-wrap" aria-hidden="true">
          {renderBars()}
        </div>

        <div className="volume-wrap">
          <div className="volume-head">
            <span>VOLUME</span>
            <span>{Math.round(settings.volume * 100)}%</span>
          </div>
          <input
            className="neo-range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(event) => void onVolumeChange(Number(event.target.value))}
          />
        </div>

        {visibleError ? (
          <div className="error-inline">
            <span>{visibleError}</span>
            <button type="button" className="retry-button" onClick={() => void onRetry()}>
              Retry
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
