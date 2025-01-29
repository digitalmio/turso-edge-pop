import type { InStatement } from "@libsql/client";
import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { publishRedisSyncCommand } from "../helpers/redis";
import { tursoProxy } from "../helpers/truso-proxy";
import { tursoClient } from "../helpers/turso-client";
import {
  hasConditionalBatch,
  hasUnsupportedTypes,
  parseTursoResultV2V3,
} from "../helpers/turso-response-parser";
import { verifyClientAuth } from "../middlewares/auth";

const route = new Hono<HonoPinoEnv>();

// Handle batch request
// returns array/tuple of response and boolean indicating if write operation was performed
const handleBatchRequest = async (
  stmt: InStatement[],
): Promise<[Record<string, unknown>, boolean]> => {
  const results = await tursoClient.batch(stmt);
  let hadWriteOperations = false;
  return [
    {
      type: "ok",
      response: {
        type: "batch" as const,
        result: {
          step_results: results.map((result) => {
            const parsedResult = parseTursoResultV2V3(result);
            hadWriteOperations = hadWriteOperations || parsedResult[1];
            return parsedResult[0];
          }),
          step_errors: new Array(results.length).fill(null),
        },
      },
    },
    hadWriteOperations,
  ];
};

// Handle execute request
// returns array/tuple of response and boolean indicating if write operation was performed
const handleExecuteRequest = async (
  stmt: InStatement,
): Promise<[Record<string, unknown>, boolean]> => {
  const result = await tursoClient.execute(stmt);
  const parsedResult = parseTursoResultV2V3(result);
  return [
    {
      type: "ok",
      response: {
        type: "execute" as const,
        result: parsedResult[0],
      },
    },
    parsedResult[1],
  ];
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
    // get user sql requests
    const { requests } = await c.req.json();

    // if requests contains types other than execute and close or simple batch, proxy to Turso
    if (hasUnsupportedTypes(requests) || hasConditionalBatch(requests)) {
      c.var.logger.assign({ type: "proxy" });
      const proxyResult = await tursoProxy(await c.req.text());

      return proxyResult.status === 200
        ? c.json(proxyResult.result)
        : c.text(proxyResult.result, proxyResult.status);
    }

    // other types run locally
    const results = [];
    let hadWriteOperations = false;
    c.var.logger.assign({ type: "local" });

    // run requests sequentially to avoid read/write problems (read your writes)
    for (const request of requests) {
      if (request.type === "execute") {
        const res = await handleExecuteRequest(request.stmt as InStatement);
        results.push(res[0]);
        hadWriteOperations = hadWriteOperations || res[1];
      } else if (request.type === "batch") {
        const res = await handleBatchRequest(
          request.batch.steps.map(
            (step: Record<string, unknown>) => step.stmt,
          ) as InStatement[],
        );
        hadWriteOperations = hadWriteOperations || res[1];
        results.push(res[0]);
      } else if (request.type === "close") {
        results.push(handleCloseRequest());
      }
    }

    if (hadWriteOperations) {
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
