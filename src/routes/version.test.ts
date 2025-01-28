import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

describe("GET /version", async () => {
  const versionRoute = (await import("./version")).default;
  const app = new Hono();
  app.route("/version", versionRoute);

  it("should return 200 OK", async () => {
    // Make the request
    const req = await app.request("/version");

    // Assertions
    expect(req.status).toBe(200);
  });
});
