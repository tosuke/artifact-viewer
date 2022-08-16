import { Hono } from "hono";

const app = new Hono();

// for backward compatibility
app.get("/api/resolve", (c) => {
  const { owner, repo, id } = c.req.query();
  return fetch(
    `https://nightly.link/${owner}/${repo}/actions/artifacts/${id}.zip`,
    { redirect: "manual" }
  );
});

app.get("/api/:owner/:repo/artifacts/:id/zip", (c) => {
  const { owner, repo, id } = c.req.param();
  return fetch(
    `https://nightly.link/${owner}/${repo}/actions/artifacts/${id}.zip`,
    { redirect: "manual" }
  );
});

app.notFound((c) => {
  return c.json({ error: "not-found" }, 404);
});

export default (req: Request) => app.fetch(req, process.env);

if (process.env.DEV) {
  app.fire();
}
