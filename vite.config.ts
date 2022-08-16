import { resolve } from "node:path";
import { defineConfig, Plugin, ResolvedConfig } from "vite";
import type { InputOption } from "rollup";
import preact from "@preact/preset-vite";

import * as esbuild from "esbuild";
import { EdgeRuntime, createHandler } from "edge-runtime";

const serviceWorkerPlugin = (src: string): Plugin[] => {
  const swEntry = "virtual:service-worker-plugin:sw";
  return [
    {
      name: "service-worker-plugin:serve",
      apply: "serve",
      resolveId(source) {
        if (source === "/sw.js") {
          return source;
        }
      },
      load(id) {
        if (id === "/sw.js") {
          return `
            import "${src}";

            location.reload = () => {
              self.registration.update();
            };
          `;
        }
      },
    },
    {
      name: "service-worker-plugin:build",
      apply: "build",
      options(options) {
        const input = options.input;
        if (input == null) return;

        let newInput: InputOption;
        if (typeof input === "string") {
          newInput = [input, swEntry];
        } else if (Array.isArray(input)) {
          newInput = [...input, swEntry];
        } else {
          newInput = {
            ...input,
            sw: swEntry,
          };
        }

        options.input = newInput;
      },
      resolveId(source) {
        if (source === swEntry) {
          return source;
        }
      },
      load(id) {
        if (id !== swEntry) return;
        const source = `import url from "${src}?worker&url"; importScripts(url);`;
        return source;
      },
      generateBundle(options, bundle) {
        for (const [key, chunkOrAsset] of Object.entries(bundle)) {
          if (chunkOrAsset.type === "chunk") {
            const chunk = chunkOrAsset;
            if (chunk.facadeModuleId === swEntry) {
              delete bundle[key];
              chunk.fileName = "sw.js";
              bundle["sw.js"] = chunk;
            }
          }
        }
      },
    },
  ];
};

const edgeFunctionPlugin = (): Plugin => {
  let resolvedConfig: ResolvedConfig;
  return {
    name: "edge-fucntion-plugin:serve",
    apply: "serve",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/api/")) {
          try {
            let result;
            result = await esbuild.build({
              entryPoints: ["src/api-handler.ts"],
              format: "iife",
              bundle: true,
              write: false,
              sourcemap: "inline",
              define: {
                "process.env.DEV": "true",
              },
            });

            const [file] = result.outputFiles;
            const runtime = new EdgeRuntime({
              initialCode: file.text,
              extend: (context) =>
                Object.assign(context, {
                  processs: {
                    env: process.env,
                  },
                }),
            });

            const { handler } = createHandler({ runtime });
            handler(req, res);
          } catch (e) {
            console.error(e);
            res.statusCode = 500;
            res.end("FUNCTION INVOCATION FAILED");
            return;
          }
        } else {
          next();
        }
      });
    },
  };
};

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
