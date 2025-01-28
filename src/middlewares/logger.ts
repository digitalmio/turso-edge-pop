import { type Env as HonoPinoEnv, pinoLogger } from "hono-pino";
import { createMiddleware } from "hono/factory";
import { appVersion, region } from "../helpers/app-vars";
import { env } from "../helpers/env";
import { redis } from "../helpers/redis";

export const registerLogger = createMiddleware(async (c, next) => {
  if (env.QUIET) {
    await next();
  } else {
    await pinoLogger({
      pino: { level: env.LOG_LEVEL },
    })(c, next);
  }
});

export const appendLoggerInfo = createMiddleware<HonoPinoEnv>(
  async (c, next) => {
    if (!env.QUIET) {
      // assign debug information to each request log
      c.var.logger.assign({
        region,
        tursoEdgePopVersion: appVersion,
        syncInterval: env.TURSO_SYNC_INTERVAL,
        redisSync: Boolean(redis),
      });
    }

    await next();
  },
);
