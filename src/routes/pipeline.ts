import type { InStatement, ResultSet } from "@libsql/client";
import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { formatValue } from "../helpers/format-value";
import { publishRedisSyncCommand } from "../helpers/redis";
import { tursoProxy } from "../helpers/truso-proxy";
import { tursoClient } from "../helpers/turso-client";
import { verifyClientAuth } from "../middlewares/auth";

const route = new Hono<HonoPinoEnv>();

const parseTursoResult = (result: ResultSet) => {
  const rows = result.rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(formatValue);
    }
    return result.columns.map((col) => formatValue(row[col]));
  });

  return {
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
  };
};

// Handle batch request
const handleBatchRequest = async (stmt: InStatement[]) => {
  const results = await tursoClient.batch(stmt);
  return {
    type: "ok",
    response: {
      type: "batch" as const,
      result: {
        step_results: results.map((result) => parseTursoResult(result)),
        step_errors: new Array(results.length).fill(null),
      },
    },
  };
};

// Handle execute request
const handleExecuteRequest = async (stmt: InStatement) => {
  const result = await tursoClient.execute(stmt);
  return {
    type: "ok",
    response: {
      type: "execute" as const,
      result: parseTursoResult(result),
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

route.post("/", verifyClientAuth, async (c) => {
  try {
    const { requests } = await c.req.json();

    // if requests contains types other than execute and close or simple batch, proxy to Turso
    const hasUnsupportedTypes = requests.some(
      (request: Record<string, unknown>) =>
        request.type !== "execute" &&
        request.type !== "close" &&
        request.type !== "batch",
    );
    const hasConditionalBatch = requests
      .filter((request: Record<string, unknown>) => request.type === "batch")
      // biome-ignore lint/suspicious/noExplicitAny: This is just used to check if exists
      .some((request: Record<string, any>) => {
        return request?.batch?.steps?.some(
          (step: Record<string, unknown>) => !!step.condition,
        );
      });

    // if requests contains types other than execute and close or simple batch, proxy to Turso
    if (hasUnsupportedTypes || hasConditionalBatch) {
      c.var.logger.assign({ type: "proxy" });
      const proxyResult = await tursoProxy(await c.req.text());
      return proxyResult.status === 200
        ? c.json(proxyResult.result)
        : c.text(proxyResult.result, proxyResult.status);
    }

    // other types run locally
    const results = [];
    c.var.logger.assign({ type: "local" });

    // run requests sequentially to avoid read/write problems (read your writes)
    for (const request of requests) {
      if (request.type === "execute") {
        results.push(await handleExecuteRequest(request.stmt as InStatement));
      } else if (request.type === "batch") {
        results.push(
          await handleBatchRequest(
            request.batch.steps.map(
              (step: Record<string, unknown>) => step.stmt,
            ) as InStatement[],
          ),
        );
      } else if (request.type === "close") {
        results.push(handleCloseRequest());
      }
    }

    const hasAffectedRows = results.some(
      (result) =>
        (result.response?.type === "execute" &&
          result.response?.result.affected_row_count !== 0) ||
        (result.response.type === "batch" &&
          result.response?.result.step_results.some(
            (res) => res.affected_row_count !== 0,
          )),
    );

    if (hasAffectedRows) {
      await publishRedisSyncCommand();
    }

    return c.json({
      baton: null,
      base_url: null,
      results,
    });
  } catch (error) {
    c.var.logger.error(error);
    return c.json(handleError(error), 500);
  }
});

export default route;
