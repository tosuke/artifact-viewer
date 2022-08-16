import type { Connect, Plugin, ResolvedConfig } from "vite";
import * as esbuild from "esbuild";
import { EdgeRuntime, createHandler } from "edge-runtime";

export const edgeFunctionPlugin = (): Plugin => {
  let resolvedConfig: ResolvedConfig;

  const enhanceServer = (middlewares: Connect.Server) => {
    middlewares.use(async (req, res, next) => {
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
          await handler(req, res);
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
  };

  return {
    name: "edge-fucntion-plugin:serve",
    apply: "serve",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      enhanceServer(server.middlewares);
    },
    configurePreviewServer({ middlewares }) {
      enhanceServer(middlewares);
    },
  };
};
