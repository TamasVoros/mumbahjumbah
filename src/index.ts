import { Hono } from "hono";

export type Bindings = { DB: D1Database };

export const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok" });
});

export default app;
