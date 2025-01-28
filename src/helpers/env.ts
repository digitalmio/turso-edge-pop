import { createEnv } from "@t3-oss/env-core";
import { fly } from "@t3-oss/env-core/presets";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Turso
    TURSO_DATABASE_URL: z.string().url(),
    TURSO_AUTH_TOKEN: z.string().startsWith("ey"),
    TURSO_SYNC_INTERVAL: z.coerce.number().default(60),

    // Local SQL database file
    DB_FILEPATH: z.string().default("/app/data/local.db"),
    DB_ENCRYPTION_KEY: z.string().optional(),

    // Redis pubsub
    REDIS_CONNECTION_STRING: z.string().url().optional(),
    REDIS_SYNC_CHANNEL: z.string().default("sync"),
    REDIS_SYNC_DEBOUNCE: z.coerce.number().default(1),

    PROXY_AUTH_TOKEN: z.string(),
    PORT: z.coerce.number().default(3000),
    REGION: z.string().optional(),
    LOG_LEVEL: z.string().default("info"),
    LOG_HIDE_TOKEN: z.coerce.boolean().default(true),
    QUIET: z.coerce.boolean().default(false),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  extends: [fly()],
});
