import { Hono } from "hono";
import { appVersion, region } from "../helpers/app-vars";

const route = new Hono();

route.get("/", (c) => {
  return c.json({
    version: appVersion,
    protocol: "hrana-2",
    region,
  });
});

export default route;
