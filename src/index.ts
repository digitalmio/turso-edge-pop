import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { cors } from "hono/cors";
import { appVersion, region } from "./helpers/app-vars";
import { env } from "./helpers/env";
import { redisSub } from "./helpers/redis";
import { syncJob } from "./jobs/sync";
import { appendLoggerInfo, registerLogger } from "./middlewares/logger";
import healthRoute from "./routes/health";
import syncRoute from "./routes/sync";
import queryRoute from "./routes/v0-query";
import pipelineRoute from "./routes/v2-v3-pipeline";
import versionRoute from "./routes/version";

const app = new Hono<HonoPinoEnv>()
  .use(registerLogger)
  .use(appendLoggerInfo)
  .use(cors());

syncJob();

app.route("/", queryRoute);

app.get("/v2", (c) => c.body(null, 200));
app.route("/v2/pipeline", pipelineRoute);
app.get("/v3", (c) => c.body(null, 200));
app.route("/v3/pipeline", pipelineRoute);

app.route("/version", versionRoute);
app.route("/health", healthRoute);
app.route("/sync", syncRoute);

if (!env.QUIET) {
  console.log(`🚀 Turso Edge Pop server running on port ${env.PORT}`);
  console.log(`📦 Version: ${appVersion}`);
  console.log(`🌎 Region: ${region}`);
  console.log(`💾 Database path: ${env.DB_FILEPATH}`);
  console.log(`⏱️ Sync Internal: ${env.TURSO_SYNC_INTERVAL} seconds`);
  console.log(`🔄 Redis sync: ${Boolean(redisSub)}`);
  console.log(`------------------------------------------------------------------
`);
}

export default {
  port: env.PORT,
  idleTimeout: 30,
  fetch: app.fetch,
};
