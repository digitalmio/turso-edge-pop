import { type Env as HonoPinoEnv, pinoLogger } from "hono-pino";
import { createMiddleware } from "hono/factory";
import { env } from "../helpers/env";
import { assignObject } from "../helpers/logger";

export const registerLogger = createMiddleware(async (c, next) => {
  if (env.QUIET) {
    await next();
  } else {
    await pinoLogger({
      pino: {
        level: env.LOG_LEVEL,
        redact: env.LOG_HIDE_TOKEN ? ["req.headers.authorization"] : [],
      },
    })(c, next);
  }
});

export const appendLoggerInfo = createMiddleware<HonoPinoEnv>(
  async (c, next) => {
    if (!env.QUIET) {
      // assign debug information to each request log
      c.var.logger.assign(assignObject);
    }

    await next();
  },
);
