import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../helpers/turso", () => {
  return {
    tursoClient: {
      sync: mock(() => Promise.resolve({ frame_no: 1, frames_synced: 1 })),
    },
  };
});

describe("GET /sync", async () => {
  const syncRoute = (await import("./sync")).default;
  const { tursoClient } = await import("../helpers/turso");
  const app = new Hono();
  app.route("/sync", syncRoute);

  it("should return 200 OK and call tursoClient.sync", async () => {
    // Make the request
    const req = await app.request("/sync", {
      headers: {
        Authorization: "Bearer 123abcMock",
      },
    });

    // Assertions
    expect(tursoClient.sync).toHaveBeenCalledTimes(1);
    expect(req.status).toBe(200);
  });
});
