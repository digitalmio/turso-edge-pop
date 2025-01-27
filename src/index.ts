import { Hono } from "hono";
import packageJson from "../package.json" assert { type: "json" };
import { env } from "./helpers/env";
import healthRoute from "./routes/health";
import pipelineRoute from "./routes/pipeline";
import syncRoute from "./routes/sync";
import versionRoute from "./routes/version";

const app = new Hono();

app.route("/v2/pipeline", pipelineRoute);
app.route("/version", versionRoute);
app.route("/health", healthRoute);
app.route("/sync", syncRoute);

const region = env.REGION ?? env.FLY_REGION ?? "default";

console.log(`🚀 Turso Edge Pop server running on port ${env.PORT}`);
console.log(`📦 Version: ${packageJson.version}`);
console.log(`🌎 Region: ${region}`);
console.log(`💾 Database path: ${env.DB_FILEPATH}`);
console.log(`⏱️ Sync Internal: ${env.TURSO_SYNC_INTERVAL}`);
console.log(`------------------------------------------------------------------
`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
