import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import path from "node:path";

export default defineConfig({
  root: "renderer",
  publicDir: path.resolve(__dirname, "assets"),
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@renderer": path.resolve(__dirname, "renderer/src")
    }
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, "electron/main.ts"),
        onstart() {
          // Electron is started by npm script after dist-electron/main.js becomes available.
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, "dist-electron"),
            emptyOutDir: false
          }
        }
      },
      preload: {
        input: path.resolve(__dirname, "electron/preload.ts"),
        vite: {
          build: {
            outDir: path.resolve(__dirname, "dist-electron"),
            emptyOutDir: false
          }
        }
      }
    })
  ]
});
