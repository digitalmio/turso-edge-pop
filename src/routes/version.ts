import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { appVersion, region } from "../helpers/app-vars";

const route = new Hono<HonoPinoEnv>();

route.get("/", (c) => {
  return c.json({
    version: appVersion,
    protocol: "hrana-2",
    region,
  });
});

export default route;
