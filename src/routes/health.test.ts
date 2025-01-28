import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

describe("GET /health", async () => {
  it("should return 200 OK and call tursoClient.execute", async () => {
    mock.module("../helpers/turso", () => {
      return {
        tursoClient: {
          execute: mock(() => Promise.resolve(1)),
        },
      };
    });

    // Make the request
    const healthRoute = (await import("./health")).default;
    const { tursoClient } = await import("../helpers/turso");
    const app = new Hono();
    app.route("/health", healthRoute);
    const req = await app.request("/health");

    // Assertions
    expect(tursoClient.execute).toHaveBeenCalledTimes(1);
    expect(req.status).toBe(200);
  });

  it("should return 503 Service Unavailable and call tursoClient.execute", async () => {
    mock.module("../helpers/turso", () => {
      return {
        tursoClient: {
          execute: mock(() => Promise.reject(null)),
        },
      };
    });

    // Make the request
    const healthRoute = (await import("./health")).default;
    const { tursoClient } = await import("../helpers/turso");
    const app = new Hono();
    app.route("/health", healthRoute);
    const req = await app.request("/health");

    // Assertions
    expect(tursoClient.execute).toHaveBeenCalledTimes(1);
    expect(req.status).toBe(503);
  });
});
