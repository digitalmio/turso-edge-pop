import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { appVersion, region } from "./helpers/app-vars";
import { env } from "./helpers/env";
import { appendLoggerInfo, registerLogger } from "./middlewares/logger";
import healthRoute from "./routes/health";
import pipelineRoute from "./routes/pipeline";
import syncRoute from "./routes/sync";
import versionRoute from "./routes/version";

const app = new Hono<HonoPinoEnv>().use(registerLogger).use(appendLoggerInfo);

app.route("/v2/pipeline", pipelineRoute);
app.route("/version", versionRoute);
app.route("/health", healthRoute);
app.route("/sync", syncRoute);

console.log(`🚀 Turso Edge Pop server running on port ${env.PORT}`);
console.log(`📦 Version: ${appVersion}`);
console.log(`🌎 Region: ${region}`);
console.log(`💾 Database path: ${env.DB_FILEPATH}`);
console.log(`⏱️ Sync Internal: ${env.TURSO_SYNC_INTERVAL}`);
console.log(`------------------------------------------------------------------
`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
