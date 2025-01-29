import type { Client, InStatement, Transaction } from "@libsql/client";
import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { publishRedisSyncCommand } from "../helpers/redis";
import { tursoClient } from "../helpers/turso-client";
import {
  hasTransactionKeywords,
  parseTursoResultV0,
  shouldUseTransactionCheck,
} from "../helpers/turso-response-parser";
import { verifyClientAuth } from "../middlewares/auth";

const route = new Hono<HonoPinoEnv>();

route.post("/", verifyClientAuth, async (c) => {
  const { statements } = await c.req.json();
  const shouldUseTransaction = shouldUseTransactionCheck(statements);
  let client: Transaction | Client | null = null;
  let hadWriteOperations = false;

  try {
    // first check if the statements contain transaction keywords
    // if they do, we need to return an error immediately - this is to align with Turso
    if (hasTransactionKeywords(statements)) {
      return c.json(
        {
          error:
            "Query error: `interactive transaction not allowed in HTTP queries`",
        },
        400,
      );
    }

    // use standard client if we don't need a transaction
    client = shouldUseTransaction
      ? await tursoClient.transaction("deferred")
      : tursoClient;

    // loop through statements and execute them
    const results = [];
    for (const statement of statements) {
      const result = await client.execute(statement as InStatement);
      const parsedResult = parseTursoResultV0(result);
      hadWriteOperations = hadWriteOperations || parsedResult[1];
      results.push(parsedResult[0]);
    }

    // commit if this is transaction
    if (shouldUseTransaction && "commit" in client) await client.commit();

    // add info about write operations to logger
    // and publish redis sync command if there were any write operations
    c.var.logger.assign({ hadWriteOperations });
    if (hadWriteOperations) await publishRedisSyncCommand();

    // return results
    return c.json(results);
  } catch (error) {
    if (shouldUseTransaction && client && "rollback" in client) {
      await client.rollback();
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : "Query error",
      },
      400,
    );
  }
});

export default route;
