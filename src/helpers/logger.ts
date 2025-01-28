import pino from "pino";
import { appVersion, region } from "./app-vars";
import { env } from "./env";
import { redis } from "./redis";

export const assignObject = {
  region,
  tursoEdgePopVersion: appVersion,
  syncInterval: env.TURSO_SYNC_INTERVAL,
  redisSync: Boolean(redis),
};

export const logger = pino().child(assignObject);
