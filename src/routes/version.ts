import { Hono } from "hono";
import packageJson from "../../package.json" assert { type: "json" };
import { env } from "../helpers/env";

const route = new Hono();

const region = env.REGION ?? env.FLY_REGION ?? "default";
route.get("/", (c) => {
  return c.json({
    version: packageJson.version,
    protocol: "hrana-2",
    region,
  });
});

export default route;
