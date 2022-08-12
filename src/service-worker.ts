import Router, { type Routes } from "universal-router";
import stubURL from "./fixture/test.zip?url";
import { ZipReader } from "./lib/zip";

const ext2mime: Record<string, string> = {
  html: "text/html",
  js: "application/javascript",
  css: "text/css",
};

const routes: Routes<Response | undefined> = [
  {
    path: "/test/:path*",
    action: async (ctx, params) => {
      try {
        if (ctx.path === "/test") {
          return new Response("", {
            status: 302,
            headers: { location: "/test/" },
          });
        }

        const path =
          (params.path as string[] | undefined)?.join("/") ?? "index.html";
        const ext = path.split(".").pop() ?? "";
        const mime = ext2mime[ext] || "application/octet-stream";

        const zipRes = await fetch(stubURL);
        if (
          zipRes.status !== 200 &&
          zipRes.headers.get("content-type") !== "application/zip"
        ) {
          return new Response("", { status: 404 });
        }

        const body = await zipRes.arrayBuffer();
        const reader = new ZipReader(new DataView(body));

        const file = reader.files.find((f) => {
          return f.fileName === path;
        });
        if (file == null || file.compressionSize === 0) {
          return new Response("", { status: 404 });
        }

        return new Response(file.decompress(), {
          status: 200,
          headers: { "content-type": mime },
        });
      } catch (e) {
        console.error(e);
        return new Response("", { status: 500 });
      }
    },
  },
];

const router = new Router(routes);

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

sw.addEventListener("install", (ev) => {
  // initialization
  console.log("install");
  ev.waitUntil(sw.skipWaiting());
});

sw.addEventListener("activate", (ev) => {
  console.log("activate");

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
  console.log(ev.type, ev.request.url);
  const pathname = new URL(ev.request.url).pathname;
  console.log(pathname);

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
