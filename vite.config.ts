import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { serviceWorkerPlugin } from "./plugins/service-worker";
import { edgeFunctionPlugin } from "./plugins/edge-function";

export default defineConfig(({ mode }) => ({
  plugins: [
    preact(),
    serviceWorkerPlugin(resolve(__dirname, "src/service-worker.ts")),
    edgeFunctionPlugin(),
  ],
  build: {
    minify: mode !== "development" ? "esbuild" : false,
    sourcemap: mode === "development",
  },
  esbuild: {
    // suppress: [vite] warning: Top-level "this" will be replaced with undefined since this file is an ECMAScript module
    logOverride: { "this-is-undefined-in-esm": "silent" },
  },
}));
