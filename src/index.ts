import { zValidator } from "@hono/zod-validator";
import type { InStatement } from "@libsql/client";
import { Hono } from "hono";
import { z } from "zod";
import packageJson from "../package.json" assert { type: "json" };
import { env } from "./helpers/env";
import { formatValue } from "./helpers/format-value";
import { tursoClient } from "./helpers/turso";
import { verifyClientAuth } from "./middlewares/auth";

const app = new Hono();

app.post(
  "/v2/pipeline",
  verifyClientAuth,
  zValidator(
    "json",
    z.object({
      requests: z.array(
        z.union([
          z.object({
            type: z.literal("execute"),
            stmt: z.union([
              z.string(),
              z.object({
                sql: z.string(),
                args: z.any(),
              }),
            ]),
          }),
          z.object({ type: z.literal("close") }),
        ]),
      ),
    }),
  ),
  async (c) => {
    try {
      const { requests } = c.req.valid("json");
      const results = [];

      for (const request of requests) {
        if (request.type === "execute") {
          const result = await tursoClient.execute(request.stmt as InStatement);

          const rows = result.rows.map((row) => {
            if (Array.isArray(row)) {
              return row.map(formatValue);
            }

            return result.columns.map((col) => formatValue(row[col]));
          });

          results.push({
            type: "ok",
            response: {
              type: "execute",
              result: {
                cols: result.columns.map((name) => ({
                  name,
                  decltype: null,
                })),
                rows,
                affected_row_count: result.rowsAffected || 0,
                last_insert_rowid: result.lastInsertRowid?.toString() ?? null,
                replication_index: null,
                rows_read: result.rows.length,
                rows_written: result.rowsAffected || 0,
                query_duration_ms: 0,
              },
            },
          });
        } else if (request.type === "close") {
          results.push({
            type: "ok",
            response: {
              type: "close",
            },
          });
        }
      }

      return c.json({
        baton: null,
        base_url: null,
        results,
      });
    } catch (error) {
      return c.json(
        {
          error: {
            message:
              error instanceof Error ? error.message : "Internal Server Error",
            code: "INTERNAL_ERROR",
          },
        },
        500,
      );
    }
  },
);

// This only makes sense if you can call selected server instance directly.
// Fly.io is using Anycast to direct your call to closest machine
app.get("/sync", verifyClientAuth, async (c) => {
  try {
    const syncData = await tursoClient.sync();
    return c.json({
      frameNo: syncData?.frame_no ?? null,
      framesSynced: syncData?.frames_synced ?? null,
    });
  } catch {
    return c.json(
      {
        error: {
          message: "Sync Error",
          code: "INTERNAL_ERROR",
        },
      },
      500,
    );
  }
});

app.get("/health", (c) => {
  return c.body(null, 200);
});

const region = env.REGION ?? env.FLY_REGION ?? "default";
app.get("/version", (c) => {
  return c.json({
    version: packageJson.version,
    protocol: "hrana-2",
    region,
  });
});

console.log(`Turso Edge Pop server running on port ${env.PORT}`);
console.log(`Region: ${region}`);
console.log(`Sync Internal: ${env.TURSO_SYNC_INTERVAL}`);
console.log(`Database path: ${env.DB_FILEPATH}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
