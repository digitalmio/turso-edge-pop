import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
describe("GET /sync", async () => {
  it("should return 200 OK and call tursoClient.sync", async () => {
    mock.module("../helpers/turso-client", () => {
      return {
        tursoClient: {
          sync: mock(() => Promise.resolve({ frame_no: 1, frames_synced: 1 })),
        },
      };
    });

    // Make the request
    const syncRoute = (await import("./sync")).default;
    const { tursoClient } = await import("../helpers/turso-client");
    const app = new Hono();
    app.route("/sync", syncRoute);
    const req = await app.request("/sync", {
      headers: {
        Authorization: "Bearer 123abcMock",
      },
    });

    // Assertions
    expect(tursoClient.sync).toHaveBeenCalledTimes(1);
    expect(req.status).toBe(200);
  });

  it("should return 503 Service Unavailable and call tursoClient.sync", async () => {
    mock.module("../helpers/turso-client", () => {
      return {
        tursoClient: {
          sync: mock(() => Promise.reject({ error: "Mock sync error" })),
        },
      };
    });

    // Make the request
    const syncRoute = (await import("./sync")).default;
    const { tursoClient } = await import("../helpers/turso-client");
    const app = new Hono();
    app.route("/sync", syncRoute);
    const req = await app.request("/sync", {
      headers: {
        Authorization: "Bearer 123abcMock",
      },
    });

    // Assertions
    expect(tursoClient.sync).toHaveBeenCalledTimes(1);
    expect(req.status).toBe(500);
  });

  it("should return 401 Unauthorized and NOT call tursoClient.sync when no auth token is provided", async () => {
    mock.module("../helpers/turso-client", () => {
      return {
        tursoClient: {
          sync: mock(() => Promise.resolve({ frame_no: 1, frames_synced: 1 })),
        },
      };
    });

    // Make the request
    const syncRoute = (await import("./sync")).default;
    const { tursoClient } = await import("../helpers/turso-client");
    const app = new Hono();
    app.route("/sync", syncRoute);
    const req = await app.request("/sync");

    // Assertions
    expect(tursoClient.sync).toHaveBeenCalledTimes(0);
    expect(req.status).toBe(401);
  });

  it("should return 401 Unauthorized and NOT call tursoClient.sync when wrong auth token is provided", async () => {
    mock.module("../helpers/turso-client", () => {
      return {
        tursoClient: {
          sync: mock(() => Promise.resolve({ frame_no: 1, frames_synced: 1 })),
        },
      };
    });

    // Make the request
    const syncRoute = (await import("./sync")).default;
    const { tursoClient } = await import("../helpers/turso-client");
    const app = new Hono();
    app.route("/sync", syncRoute);
    const req = await app.request("/sync", {
      headers: {
        Authorization: "Bearer wrongBearerToken",
      },
    });

    // Assertions
    expect(tursoClient.sync).toHaveBeenCalledTimes(0);
    expect(req.status).toBe(401);
  });
});
