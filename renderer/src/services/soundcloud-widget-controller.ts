const SOUNDCLOUD_WIDGET_SCRIPT_SRC = "https://w.soundcloud.com/player/api.js";

type VoidListener = () => void;
type ErrorListener = (error: Error) => void;

interface SoundCloudWidgetEvents {
  READY: string;
  FINISH: string;
  ERROR?: string;
}

interface SoundCloudWidgetLoadOptions {
  auto_play?: boolean;
  show_artwork?: boolean;
  show_comments?: boolean;
  show_playcount?: boolean;
  show_user?: boolean;
  visual?: boolean;
  callback?: () => void;
}

interface SoundCloudWidget {
  bind(eventName: string, listener: VoidListener): void;
  load(url: string, options?: SoundCloudWidgetLoadOptions): void;
  play(): void;
  pause(): void;
  setVolume(volume: number): void;
}

interface SoundCloudGlobal {
  Widget: {
    (element: HTMLIFrameElement): SoundCloudWidget;
    Events: SoundCloudWidgetEvents;
  };
}

declare global {
  interface Window {
    SC?: SoundCloudGlobal;
  }
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export class SoundCloudWidgetController {
  private static scriptPromise: Promise<void> | undefined;
  private iframe: HTMLIFrameElement | null = null;
  private widget: SoundCloudWidget | null = null;
  private initialized = false;
  private readonly finishListeners = new Set<VoidListener>();
  private readonly readyListeners = new Set<VoidListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  onFinish(listener: VoidListener): () => void {
    this.finishListeners.add(listener);
    return () => {
      this.finishListeners.delete(listener);
    };
  }

  onReady(listener: VoidListener): () => void {
    this.readyListeners.add(listener);
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  async ensureReady(): Promise<void> {
    await SoundCloudWidgetController.ensureScript();

    if (!this.initialized) {
      this.createWidget();
      this.initialized = true;
    }
  }

  async loadTrack(trackUrl: string): Promise<void> {
    await this.ensureReady();
    const widget = this.requireWidget();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let offError: () => void = () => undefined;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        offError();
        reject(new Error("Source unavailable"));
      }, 15000);

      offError = this.onError((error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        offError();
        reject(error);
      });

      try {
        widget.load(trackUrl, {
          auto_play: false,
          show_artwork: false,
          show_comments: false,
          show_playcount: false,
          show_user: false,
          visual: false,
          callback: () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            offError();
            resolve();
          }
        });
      } catch {
        window.clearTimeout(timeout);
        offError();
        reject(new Error("Source unavailable"));
      }
    });
  }

  async play(): Promise<void> {
    await this.ensureReady();
    this.requireWidget().play();
  }

  async pause(): Promise<void> {
    if (!this.widget) return;
    this.widget.pause();
  }

  async setVolume(value01: number): Promise<void> {
    if (!this.widget) return;
    this.widget.setVolume(Math.round(clamp01(value01) * 100));
  }

  destroy(): void {
    this.finishListeners.clear();
    this.readyListeners.clear();
    this.errorListeners.clear();
    this.widget = null;
    this.initialized = false;
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  private createWidget(): void {
    const sc = window.SC;
    if (!sc) {
      throw new Error("Source unavailable");
    }

    if (!this.iframe) {
      this.iframe = document.createElement("iframe");
      this.iframe.id = "aega-sc-widget";
      this.iframe.style.position = "fixed";
      this.iframe.style.width = "1px";
      this.iframe.style.height = "1px";
      this.iframe.style.border = "0";
      this.iframe.style.opacity = "0";
      this.iframe.style.pointerEvents = "none";
      this.iframe.style.left = "-9999px";
      this.iframe.allow = "autoplay";
      this.iframe.src =
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fmythostempest%2Fidea-22-but-it-sounds-like&auto_play=false&visual=false";
      document.body.appendChild(this.iframe);
    }

    this.widget = sc.Widget(this.iframe);
    this.bindWidgetEvents();
  }

  private bindWidgetEvents(): void {
    if (!this.widget || !window.SC) {
      return;
    }

    const events = window.SC.Widget.Events;
    this.widget.bind(events.READY, () => {
      for (const listener of this.readyListeners) {
        listener();
      }
    });
    this.widget.bind(events.FINISH, () => {
      for (const listener of this.finishListeners) {
        listener();
      }
    });

    if (events.ERROR) {
      this.widget.bind(events.ERROR, () => {
        this.emitError(new Error("Source unavailable"));
      });
    }
  }

  private emitError(error: Error): void {
    for (const listener of this.errorListeners) {
      listener(error);
    }
  }

  private requireWidget(): SoundCloudWidget {
    if (!this.widget) {
      throw new Error("Source unavailable");
    }
    return this.widget;
  }

  private static ensureScript(): Promise<void> {
    if (window.SC?.Widget) {
      return Promise.resolve();
    }

    if (!SoundCloudWidgetController.scriptPromise) {
      SoundCloudWidgetController.scriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${SOUNDCLOUD_WIDGET_SCRIPT_SRC}"]`
        );
        if (existing) {
          if (window.SC?.Widget) {
            resolve();
            return;
          }
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("Source unavailable")), {
            once: true
          });
          window.setTimeout(() => {
            if (window.SC?.Widget) {
              resolve();
            }
          }, 1000);
          return;
        }

        const script = document.createElement("script");
        script.src = SOUNDCLOUD_WIDGET_SCRIPT_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Source unavailable"));
        document.head.appendChild(script);
      }).catch((error) => {
        SoundCloudWidgetController.scriptPromise = undefined;
        throw error;
      });
    }

    return SoundCloudWidgetController.scriptPromise;
  }
}
