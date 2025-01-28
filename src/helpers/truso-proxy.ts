import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "./env";
import { tursoClient } from "./turso-client";

export const tursoProxy = async (requests: string) => {
  const response = await fetch(`${env.TURSO_DATABASE_URL}/v3/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: requests,
  });

  const status = response.status as ContentfulStatusCode;

  // Sync to local database
  if (status === 200) {
    await tursoClient.sync();
  }

  return {
    status,
    result: status === 200 ? await response.json() : await response.text(),
  };
};
