import type { AuraBridge } from "@shared/types/ipc";

declare global {
  interface Window {
    aura: AuraBridge;
  }
}

export {};