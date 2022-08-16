import type { Plugin } from "vite";
import type { InputOption } from "rollup";

export const serviceWorkerPlugin = (src: string): Plugin[] => {
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
