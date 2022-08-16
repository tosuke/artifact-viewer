import Router, { type Routes } from "universal-router";
import { ZipReader } from "./lib/zip";

const ext2mime: Record<string, string> = {
  html: "text/html",
  js: "application/javascript",
  css: "text/css",
};

const routes: Routes<Response | undefined> = [
  {
    path: "/:owner/:repo/artifacts/:id/:path*",
    action: async (ctx, params) => {
      try {
        const owner = params.owner as string;
        const repo = params.repo as string;
        const id = params.id as string;

        const searchParams = new URLSearchParams({
          owner,
          repo,
          id,
        });

        const zipReq = new Request(`/api/resolve?${searchParams.toString()}`, {
          redirect: "follow",
        });
        const cache = await sw.caches.open("v1");
        const cachedZipRes = await cache.match(zipReq);
        const zipRes = cachedZipRes ?? (await fetch(zipReq));

        if (
          zipRes.status !== 200 ||
          zipRes.headers.get("content-type") !== "application/zip"
        ) {
          return new Response("", { status: zipRes.status });
        }

        if (cachedZipRes == null) {
          await cache.put(zipReq, zipRes.clone());
        }

        const zipBody = await zipRes.arrayBuffer();
        const reader = new ZipReader(new DataView(zipBody));

        const path =
          (params.path as string[] | undefined)?.join("/") ?? "index.html";

        if (params.path == null && !ctx.pathname.endsWith("/")) {
          return new Response("", {
            status: 302,
            headers: { location: ctx.pathname + "/" },
          });
        }

        let file = reader.files.find((f) => {
          if (f.isDirectory) {
            return f.fileName === path + "/";
          } else {
            return f.fileName === path;
          }
        });
        if (file == null) {
          return new Response("", { status: 404 });
        }
        if (file.isDirectory) {
          if (ctx.pathname.endsWith("/")) {
            file = reader.files.find(
              (f) => f.fileName === path + "/index.html"
            );
            if (file == null) {
              return new Response("", { status: 404 });
            }
          } else {
            return new Response("", {
              status: 302,
              headers: { location: ctx.pathname + "/" },
            });
          }
        }

        const ext = file.fileName.split(".").pop() ?? "";
        const mime = ext2mime[ext] ?? "application/octet-stream";

        return new Response(file.decompress(), {
          status: 200,
          headers: { "content-type": mime },
        });
      } catch (err: unknown) {
        console.error(err);
        return new Response("", { status: 500 });
      }
    },
  },
];

const router = new Router(routes);

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

sw.addEventListener("install", (ev) => {
  ev.waitUntil(sw.skipWaiting());
});

sw.addEventListener("activate", (ev) => {
  const navigationPreloadTask =
    sw.registration.navigationPreload?.disable() ?? Promise.resolve();

  ev.waitUntil(
    navigationPreloadTask
      .then(() => sw.clients.claim())
      .catch((err) => {
        console.error("failed to activate:", err);
      })
  );
});

sw.addEventListener("fetch", (ev) => {
  const pathname = new URL(ev.request.url).pathname;

  ev.respondWith(
    router
      .resolve(pathname)
      .then((result) => result)
      .catch((err) => {
        if (err.status != null && err.status != 404) {
          console.error(err, err.status);
        }
        return null;
      })
      .then((result) => {
        if (result == null) return fetch(ev.request);
        return result;
      })
  );
});
