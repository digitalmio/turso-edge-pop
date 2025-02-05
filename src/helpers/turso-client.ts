import { createClient } from "@libsql/client";
import { env } from "./env";
import { logger } from "./logger";

let isSyncing = false;

const setIsSyncing = (value = true) => {
  isSyncing = value;
};

// we are not using "built in" syncInterval, as this can corrupt the database if run in parallel to manual syncs
// due to this fact, interval syncing is done manually, check src/jobs/interval-sync.ts
export const tursoClient = createClient({
  url: `file:${env.DB_FILEPATH}`,
  syncUrl: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
  encryptionKey: env.DB_ENCRYPTION_KEY,
  fetch, // use Bun native fetch
});

export const tursoClientSync = async (type: "interval" | "pubsub" | "api") => {
  const typeUpperFirst = type.charAt(0).toUpperCase() + type.slice(1);
  if (!isSyncing) {
    setIsSyncing(true);
    await tursoClient.sync();
    logger.info(`${typeUpperFirst} Sync triggered`);
    setIsSyncing(false);
  } else {
    logger.info(
      `${typeUpperFirst} Sync skipped, parallel sync already running`,
    );
  }
};
