const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

type VoidListener = () => void;
type ErrorListener = (error: Error) => void;

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data?: number;
}

interface YouTubePlayer {
  destroy(): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  setVolume(volume: number): void;
  unMute?(): void;
}

interface YouTubePlayerCtor {
  new (
    elementId: string,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerEvent) => void;
        onError?: (event: YouTubePlayerEvent) => void;
      };
    }
  ): YouTubePlayer;
}

interface YouTubeGlobal {
  Player: YouTubePlayerCtor;
  PlayerState: {
    PLAYING: number;
    ENDED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toYouTubeErrorMessage = (code?: number): string => {
  if (code === 2) return "Source unavailable (YT 2: invalid video parameter)";
  if (code === 5) return "Source unavailable (YT 5: HTML5 playback error)";
  if (code === 100) return "Source unavailable (YT 100: video not found/private)";
  if (code === 101) return "Source unavailable (YT 101: embed disabled by owner)";
  if (code === 150) return "Source unavailable (YT 150: embed disabled by owner)";
  return "Source unavailable (YT unknown)";
};

const parseYouTubeVideoId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export class YouTubeWidgetController {
  private static scriptPromise: Promise<void> | undefined;
  private container: HTMLDivElement | null = null;
  private player: YouTubePlayer | null = null;
  private initialized = false;
  private readonly finishListeners = new Set<VoidListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private pendingPlay:
    | { resolve: () => void; reject: (error: Error) => void; timeoutId: number }
    | null = null;

  onFinish(listener: VoidListener): () => void {
    this.finishListeners.add(listener);
    return () => {
      this.finishListeners.delete(listener);
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  async ensureReady(): Promise<void> {
    await YouTubeWidgetController.ensureScript();
  }

  async loadTrack(trackUrl: string): Promise<void> {
    const videoId = parseYouTubeVideoId(trackUrl);
    if (!videoId) {
      throw new Error("Source unavailable");
    }

    await this.ensureReady();
    if (!this.initialized || !this.player) {
      await this.createPlayer(videoId);
      return;
    }

    this.player.loadVideoById(videoId, 0);
    this.player.pauseVideo();
  }

  async play(): Promise<void> {
    if (!this.player) {
      throw new Error("Source unavailable");
    }

    return new Promise<void>((resolve, reject) => {
      this.clearPendingPlay();
      const timeoutId = window.setTimeout(() => {
        this.pendingPlay = null;
        reject(new Error("Source unavailable"));
      }, 5000);

      this.pendingPlay = { resolve, reject, timeoutId };
      this.player!.unMute?.();
      this.player!.playVideo();
    });
  }

  async pause(): Promise<void> {
    if (!this.player) return;
    this.player.pauseVideo();
  }

  async setVolume(value01: number): Promise<void> {
    if (!this.player) return;
    this.player.setVolume(Math.round(clamp01(value01) * 100));
  }

  destroy(): void {
    this.finishListeners.clear();
    this.errorListeners.clear();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.initialized = false;
  }

  private async createPlayer(videoId: string): Promise<void> {
    if (!window.YT?.Player) {
      throw new Error("Source unavailable");
    }

    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "aega-youtube-widget";
      this.container.style.position = "fixed";
      this.container.style.width = "1px";
      this.container.style.height = "1px";
      this.container.style.left = "-9999px";
      this.container.style.top = "0";
      this.container.style.opacity = "0";
      this.container.style.pointerEvents = "none";
      document.body.appendChild(this.container);
    }

    this.player = await new Promise<YouTubePlayer>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Source unavailable")), 15000);
      try {
        const player = new window.YT!.Player(this.container!.id, {
          width: "1",
          height: "1",
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              window.clearTimeout(timeout);
              resolve(event.target);
            },
            onStateChange: (event) => {
              if (event.data === window.YT!.PlayerState.PLAYING) {
                if (this.pendingPlay) {
                  window.clearTimeout(this.pendingPlay.timeoutId);
                  const { resolve } = this.pendingPlay;
                  this.pendingPlay = null;
                  resolve();
                }
                return;
              }

              if (event.data === window.YT!.PlayerState.ENDED) {
                for (const listener of this.finishListeners) {
                  listener();
                }
              }
            },
            onError: (event) => {
              const error = new Error(toYouTubeErrorMessage(event.data));
              if (this.pendingPlay) {
                window.clearTimeout(this.pendingPlay.timeoutId);
                const { reject } = this.pendingPlay;
                this.pendingPlay = null;
                reject(error);
              }
              for (const listener of this.errorListeners) {
                listener(error);
              }
            }
          }
        });
        void player;
      } catch {
        window.clearTimeout(timeout);
        reject(new Error("Source unavailable"));
      }
    });

    this.initialized = true;
    this.player.pauseVideo();
  }

  private static ensureScript(): Promise<void> {
    if (window.YT?.Player) {
      return Promise.resolve();
    }

    if (!YouTubeWidgetController.scriptPromise) {
      YouTubeWidgetController.scriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${YOUTUBE_IFRAME_API_SRC}"]`
        );
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          previousReady?.();
          resolve();
        };

        if (!existing) {
          const script = document.createElement("script");
          script.src = YOUTUBE_IFRAME_API_SRC;
          script.async = true;
          script.onerror = () => reject(new Error("Source unavailable"));
          document.head.appendChild(script);
        }
      }).catch((error) => {
        YouTubeWidgetController.scriptPromise = undefined;
        throw error;
      });
    }

    return YouTubeWidgetController.scriptPromise;
  }

  private clearPendingPlay(): void {
    if (!this.pendingPlay) {
      return;
    }
    window.clearTimeout(this.pendingPlay.timeoutId);
    this.pendingPlay = null;
  }
}
