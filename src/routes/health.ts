import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { tursoClient } from "../helpers/turso-client";

const route = new Hono<HonoPinoEnv>();

route.get("/", async (c) => {
  try {
    // Add basic DB connectivity check
    await tursoClient.execute("SELECT 1");
    return c.json({ status: "ok" }, 200);
  } catch (error) {
    return c.json({ status: "error" }, 503);
  }
});

export default route;
