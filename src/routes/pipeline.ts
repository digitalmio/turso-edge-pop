import { zValidator } from "@hono/zod-validator";
import type { InStatement } from "@libsql/client";
import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { z } from "zod";
import { formatValue } from "../helpers/format-value";
import { publishRedisSyncCommand } from "../helpers/redis";
import { tursoClient } from "../helpers/turso";
import { verifyClientAuth } from "../middlewares/auth";

const route = new Hono<HonoPinoEnv>();

// Schema definition for request validation
const pipelineSchema = z.object({
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
          z.object({
            sql: z.string(),
            named_args: z.any(),
          }),
        ]),
      }),
      z.object({ type: z.literal("close") }),
    ]),
  ),
});

// Handle execute request
const handleExecuteRequest = async (stmt: InStatement) => {
  const result = await tursoClient.execute(stmt);

  const rows = result.rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(formatValue);
    }
    return result.columns.map((col) => formatValue(row[col]));
  });

  return {
    type: "ok",
    response: {
      type: "execute" as const,
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
  };
};

// Handle close request
const handleCloseRequest = () => {
  return {
    type: "ok",
    response: {
      type: "close" as const,
    },
  };
};

// Handle error response
const handleError = (error: unknown) => {
  return {
    error: {
      message: error instanceof Error ? error.message : "Internal Server Error",
      code: "INTERNAL_ERROR",
    },
  };
};

route.post(
  "/",
  verifyClientAuth,
  zValidator("json", pipelineSchema),
  async (c) => {
    try {
      const { requests } = c.req.valid("json");
      const results = [];

      // run requests sequentially to avoid read/write problems (read your writes)
      for (const request of requests) {
        if (request.type === "execute") {
          results.push(await handleExecuteRequest(request.stmt as InStatement));
        } else if (request.type === "close") {
          results.push(handleCloseRequest());
        }
      }

      const hasAffectedRows = results.some(
        (result) =>
          result.response.type === "execute" &&
          result.response.result.affected_row_count !== 0,
      );
      c.var.logger.assign({ hasAffectedRows });

      if (hasAffectedRows) {
        await publishRedisSyncCommand();
      }

      return c.json({
        baton: null,
        base_url: null,
        results,
      });
    } catch (error) {
      console.error(error);
      return c.json(handleError(error), 500);
    }
  },
);

export default route;
