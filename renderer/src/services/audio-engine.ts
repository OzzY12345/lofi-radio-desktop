import type { AudioEngineState } from "@shared/types/audio";
import type { AudioSource, AudioSourceProvider } from "@shared/types/source";
import { SoundCloudWidgetController } from "./soundcloud-widget-controller";
import { YouTubeWidgetController } from "./youtube-widget-controller";

type StateListener = (state: AudioEngineState) => void;

const clamp01 = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Source unavailable";
};

const waitForPlaybackReady = (audio: HTMLAudioElement): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onCanPlay = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Source unavailable"));
    };

    const cleanup = () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };

    audio.addEventListener("canplay", onCanPlay, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.load();
  });
};

export class AudioEngine {
  private readonly audio = new Audio();
  private readonly provider: AudioSourceProvider;
  private readonly fadeDurationMs: number;
  private readonly listeners = new Set<StateListener>();
  private readonly soundCloud = new SoundCloudWidgetController();
  private readonly youTube = new YouTubeWidgetController();
  private fadeToken = 0;
  private embedVolume = 0;

  private state: AudioEngineState = {
    status: "idle",
    availableSources: [],
    currentTrackIndex: undefined,
    queueLength: undefined,
    volume: 0.6,
    error: undefined
  };

  private targetVolume = 0.6;
  private readonly sadBoostMultiplier = 2;

  constructor(provider: AudioSourceProvider, initialVolume = 0.6, fadeDurationMs = 700) {
    this.provider = provider;
    this.targetVolume = clamp01(initialVolume);
    this.fadeDurationMs = fadeDurationMs;

    this.audio.loop = true;
    this.audio.preload = "none";
    this.audio.volume = this.targetVolume;
    this.embedVolume = this.targetVolume;

    this.audio.addEventListener("error", () => {
      if (this.state.currentSource?.kind === "embed") {
        return;
      }
      this.setState({ status: "error", error: "Source unavailable" });
    });

    this.audio.addEventListener("ended", () => {
      this.setState({ status: "paused" });
    });

    this.soundCloud.onFinish(() => {
      void this.handleEmbedFinish();
    });

    this.youTube.onFinish(() => {
      void this.handleEmbedFinish();
    });
    this.youTube.onError((error) => {
      this.setState({ status: "error", error: toErrorMessage(error) });
    });
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AudioEngineState {
    return this.state;
  }

  async play(): Promise<void> {
    if (!this.state.currentSource) {
      this.setState({ status: "error", error: "Source unavailable" });
      return;
    }

    this.setState({ status: "loading", error: undefined });

    try {
      if (this.state.currentSource.kind === "embed") {
        void this.setActiveEmbedVolume(0);
        this.embedVolume = 0;
        await this.playActiveEmbed();
        await this.fadeEmbedTo(this.targetVolume);
        this.setState({ status: "playing", error: undefined });
        return;
      }

      this.audio.volume = 0;
      await this.audio.play();
      await this.fadeHtmlTo(this.getEffectiveHtmlTargetVolume());
      this.setState({ status: "playing", error: undefined });
    } catch (error) {
      this.setState({ status: "error", error: toErrorMessage(error) });
    }
  }

  async pause(): Promise<void> {
    if (this.state.status !== "playing") {
      return;
    }

    if (this.state.currentSource?.kind === "embed") {
      await this.fadeEmbedTo(0);
      await this.pauseAllEmbeds();
      await this.setActiveEmbedVolume(this.targetVolume);
      this.embedVolume = this.targetVolume;
      this.setState({ status: "paused" });
      return;
    }

    await this.fadeHtmlTo(0);
    this.audio.pause();
    this.audio.volume = this.getEffectiveHtmlTargetVolume();
    this.setState({ status: "paused" });
  }

  stop(): void {
    this.fadeToken += 1;
    if (this.state.currentSource?.kind === "embed") {
      void this.pauseAllEmbeds();
      void this.setActiveEmbedVolume(this.targetVolume);
      this.embedVolume = this.targetVolume;
    } else {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.volume = this.getEffectiveHtmlTargetVolume();
    }
    this.setState({ status: "idle", error: undefined });
  }

  setVolume(value: number): void {
    this.targetVolume = clamp01(value);
    if (this.state.status === "playing" && this.state.currentSource?.kind === "embed") {
      this.embedVolume = this.targetVolume;
      void this.setActiveEmbedVolume(this.targetVolume);
    } else if (this.state.status === "playing") {
      this.audio.volume = this.getEffectiveHtmlTargetVolume();
    }
    this.setState({ volume: this.targetVolume });
  }

  async setMood(moodId: string): Promise<void> {
    const wasPlaying = this.state.status === "playing";

    if (wasPlaying) {
      await this.pauseCurrentForTransition();
    }

    this.setState({ status: "loading", currentMoodId: moodId, error: undefined });

    try {
      const sources = await this.provider.listSourcesForMood(moodId);
      if (sources.length === 0) {
        throw new Error("Source unavailable");
      }

      const preferredSource = this.state.currentSource
        ? sources.find((source) => source.id === this.state.currentSource?.id)
        : undefined;

      const source = preferredSource ?? sources[0];
      const sourceIndex = Math.max(0, sources.findIndex((item) => item.id === source.id));

      await this.bindSource(source, false);
      this.setState({
        availableSources: sources,
        currentSource: source,
        currentTrackIndex: source.kind === "stream" ? undefined : sourceIndex,
        queueLength: source.kind === "stream" ? undefined : sources.length,
        status: "paused",
        error: undefined
      });

      if (wasPlaying) {
        await this.play();
      }
    } catch (error) {
      this.setState({
        availableSources: [],
        currentSource: undefined,
        currentTrackIndex: undefined,
        queueLength: undefined,
        status: "error",
        error: toErrorMessage(error)
      });
    }
  }

  async setSource(source: AudioSource): Promise<void> {
    const wasPlaying = this.state.status === "playing";
    const sourceIndex = Math.max(
      0,
      this.state.availableSources.findIndex((item) => item.id === source.id)
    );

    if (wasPlaying) {
      await this.pauseCurrentForTransition();
    }

    try {
      await this.bindSource(source, false);
      this.setState({
        currentSource: source,
        currentTrackIndex: source.kind === "stream" ? undefined : sourceIndex,
        queueLength: source.kind === "stream" ? undefined : this.state.availableSources.length,
        error: undefined,
        status: "paused"
      });

      if (wasPlaying) {
        await this.play();
      }
    } catch (error) {
      this.setState({ status: "error", error: toErrorMessage(error) });
    }
  }

  async retry(): Promise<void> {
    if (!this.state.currentSource && !this.state.currentMoodId) {
      this.setState({ status: "error", error: "Source unavailable" });
      return;
    }

    if (this.state.currentSource) {
      await this.setSource(this.state.currentSource);
      await this.play();
      return;
    }

    if (this.state.currentMoodId) {
      await this.setMood(this.state.currentMoodId);
      await this.play();
    }
  }

  async nextSourceInQueue(): Promise<void> {
    if (!this.state.currentSource || this.state.currentSource.kind === "stream" || this.state.availableSources.length === 0) {
      return;
    }

    const currentIndex =
      this.state.currentTrackIndex ??
      this.state.availableSources.findIndex((item) => item.id === this.state.currentSource?.id);
    const nextIndex = (Math.max(0, currentIndex) + 1) % this.state.availableSources.length;
    await this.setSource(this.state.availableSources[nextIndex]);
  }

  async prevSourceInQueue(): Promise<void> {
    if (!this.state.currentSource || this.state.currentSource.kind === "stream" || this.state.availableSources.length === 0) {
      return;
    }

    const currentIndex =
      this.state.currentTrackIndex ??
      this.state.availableSources.findIndex((item) => item.id === this.state.currentSource?.id);
    const prevIndex =
      (Math.max(0, currentIndex) - 1 + this.state.availableSources.length) %
      this.state.availableSources.length;
    await this.setSource(this.state.availableSources[prevIndex]);
  }

  private async bindSource(source: AudioSource, autoPlay: boolean): Promise<void> {
    if (source.kind === "embed") {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = "";
      const embedKind = this.resolveEmbedKind(source.uri);
      if (!embedKind) {
        throw new Error("Source unavailable");
      }

      if (embedKind === "soundcloud") {
        await this.youTube.pause();
        await this.soundCloud.loadTrack(source.uri);
      } else {
        await this.soundCloud.pause();
        await this.youTube.loadTrack(source.uri);
      }

      await this.setActiveEmbedVolume(0);
      this.embedVolume = 0;

      if (autoPlay) {
        await this.play();
      }
      return;
    }

    await this.pauseAllEmbeds();
    this.audio.src = source.uri;
    this.audio.currentTime = 0;

    if (source.kind === "local") {
      await waitForPlaybackReady(this.audio);
    }

    if (autoPlay) {
      await this.play();
    }
  }

  private async pauseCurrentForTransition(): Promise<void> {
    if (this.state.currentSource?.kind === "embed") {
      await this.fadeEmbedTo(0);
      await this.pauseAllEmbeds();
      await this.setActiveEmbedVolume(this.targetVolume);
      this.embedVolume = this.targetVolume;
      return;
    }

    await this.fadeHtmlTo(0);
    this.audio.pause();
    this.audio.volume = this.getEffectiveHtmlTargetVolume();
  }

  private setState(next: Partial<AudioEngineState>): void {
    this.state = {
      ...this.state,
      ...next
    };

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private fadeHtmlTo(targetVolume: number): Promise<void> {
    const token = ++this.fadeToken;
    const start = this.audio.volume;
    const end = clamp01(targetVolume);

    if (Math.abs(start - end) < 0.001) {
      this.audio.volume = end;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startedAt = performance.now();

      const tick = (now: number) => {
        if (token !== this.fadeToken) {
          resolve();
          return;
        }

        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / this.fadeDurationMs);
        const next = start + (end - start) * progress;
        this.audio.volume = clamp01(next);

        if (progress >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  private fadeEmbedTo(targetVolume: number): Promise<void> {
    const token = ++this.fadeToken;
    const start = this.embedVolume;
    const end = clamp01(targetVolume);

    if (Math.abs(start - end) < 0.001) {
      this.embedVolume = end;
      void this.setActiveEmbedVolume(end);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startedAt = performance.now();

      const tick = (now: number) => {
        if (token !== this.fadeToken) {
          resolve();
          return;
        }

        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / this.fadeDurationMs);
        const next = start + (end - start) * progress;
        this.embedVolume = clamp01(next);
        void this.setActiveEmbedVolume(this.embedVolume);

        if (progress >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  private async handleEmbedFinish(): Promise<void> {
    if (this.state.currentSource?.kind !== "embed" || this.state.availableSources.length === 0) {
      return;
    }

    await this.nextSourceInQueue();
  }

  private resolveEmbedKind(uri: string): "soundcloud" | "youtube" | null {
    const value = uri.toLowerCase();
    if (value.includes("soundcloud.com")) {
      return "soundcloud";
    }
    if (value.includes("youtube.com") || value.includes("youtu.be")) {
      return "youtube";
    }
    return null;
  }

  private async playActiveEmbed(): Promise<void> {
    const kind = this.state.currentSource?.uri ? this.resolveEmbedKind(this.state.currentSource.uri) : null;
    if (!kind) {
      throw new Error("Source unavailable");
    }
    if (kind === "soundcloud") {
      await this.soundCloud.play();
      return;
    }
    await this.youTube.play();
  }

  private async setActiveEmbedVolume(value: number): Promise<void> {
    const kind = this.state.currentSource?.uri ? this.resolveEmbedKind(this.state.currentSource.uri) : null;
    if (!kind) {
      return;
    }
    if (kind === "soundcloud") {
      await this.soundCloud.setVolume(value);
      return;
    }
    await this.youTube.setVolume(value);
  }

  private async pauseAllEmbeds(): Promise<void> {
    await Promise.all([this.soundCloud.pause(), this.youTube.pause()]);
  }

  private getEffectiveHtmlTargetVolume(): number {
    const isSadLocal = this.state.currentMoodId === "sad" && this.state.currentSource?.kind === "local";
    if (!isSadLocal) {
      return this.targetVolume;
    }
    return clamp01(this.targetVolume * this.sadBoostMultiplier);
  }
}
