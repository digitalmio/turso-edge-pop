import { createEnv } from "@t3-oss/env-core";
import { fly } from "@t3-oss/env-core/presets";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Turso
    TURSO_DATABASE_URL: z.string().url(),
    TURSO_AUTH_TOKEN: z.string().startsWith("ey"),
    TURSO_SYNC_INTERVAL: z.coerce.number().default(60),

    // App
    DB_FILEPATH: z.string().default("/app/data/local.db"),
    DB_ENCRYPTION_KEY: z.string().optional(),

    PROXY_AUTH_TOKEN: z.string(),
    PORT: z.coerce.number().default(3000),
    REGION: z.string().optional(),
    LOG_LEVEL: z.string().default("info"),
    QUIET: z.coerce.boolean().default(false),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  extends: [fly()],
});
