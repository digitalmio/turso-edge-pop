import { createClient } from "@libsql/client";
import { env } from "./env";

export const tursoClient = createClient({
  url: `file:${env.DB_FILEPATH}`,
  syncUrl: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
  syncInterval: env.TURSO_SYNC_INTERVAL,
  // encryptionKey: env.DB_ENCRYPTION_KEY,
  fetch, // use Bun native fetch
});
