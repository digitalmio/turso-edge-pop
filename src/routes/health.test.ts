import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../helpers/turso", () => {
  return {
    tursoClient: {
      execute: mock(() => Promise.resolve(1)),
    },
  };
});

describe("GET /health", async () => {
  const healthRoute = (await import("./health")).default;
  const { tursoClient } = await import("../helpers/turso");
  const app = new Hono();
  app.route("/health", healthRoute);

  it("should return 200 OK and call tursoClient.execute", async () => {
    // Make the request
    const req = await app.request("/health");

    // Assertions
    expect(tursoClient.execute).toHaveBeenCalledTimes(1);
    expect(req.status).toBe(200);
  });
});
