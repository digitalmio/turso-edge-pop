import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { appendLoggerInfo, registerLogger } from "../middlewares/logger";

describe("POST /pipeline", () => {
  it("should handle execute request successfully", async () => {
    // Mock turso client
    mock.module("../helpers/turso-client", () => ({
      tursoClient: {
        execute: mock(() =>
          Promise.resolve({
            rows: [["value1", "value2"]],
            columns: ["col1", "col2"],
            rowsAffected: 1,
            lastInsertRowid: 123n,
          }),
        ),
      },
    }));

    // Make the request
    const pipelineRoute = (await import("./pipeline")).default;
    const { tursoClient } = await import("../helpers/turso-client");
    const app = new Hono<HonoPinoEnv>()
      .use(registerLogger)
      .use(appendLoggerInfo);
    app.route("/v2/pipeline", pipelineRoute);

    const req = await app.request("/v2/pipeline", {
      method: "POST",
      headers: {
        Authorization: "Bearer 123abcMock",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            type: "execute",
            stmt: "SELECT * FROM test",
          },
        ],
      }),
    });

    // Assertions
    expect(req.status).toBe(200);
    const response = await req.json();
    expect(response).toEqual({
      baton: null,
      base_url: null,
      results: [
        {
          type: "ok",
          response: {
            type: "execute",
            result: {
              cols: [
                { name: "col1", decltype: null },
                { name: "col2", decltype: null },
              ],
              rows: [
                [
                  {
                    type: "text",
                    value: "value1",
                  },
                  {
                    type: "text",
                    value: "value2",
                  },
                ],
              ],
              affected_row_count: 1,
              last_insert_rowid: "123",
              replication_index: null,
              rows_read: 1,
              rows_written: 1,
              query_duration_ms: 0,
            },
          },
        },
      ],
    });
    expect(tursoClient.execute).toHaveBeenCalledTimes(1);
  });

  it("should handle close request successfully", async () => {
    // Make the request
    const pipelineRoute = (await import("./pipeline")).default;
    const app = new Hono<HonoPinoEnv>()
      .use(registerLogger)
      .use(appendLoggerInfo);
    app.route("/v2/pipeline", pipelineRoute);

    const req = await app.request("/v2/pipeline", {
      method: "POST",
      headers: {
        Authorization: "Bearer 123abcMock",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            type: "close",
          },
        ],
      }),
    });

    // Assertions
    expect(req.status).toBe(200);
    const response = await req.json();
    expect(response).toEqual({
      baton: null,
      base_url: null,
      results: [
        {
          type: "ok",
          response: {
            type: "close",
          },
        },
      ],
    });
  });

  it("should handle database error", async () => {
    // Mock turso client with error
    mock.module("../helpers/turso-client", () => ({
      tursoClient: {
        execute: mock(() => Promise.reject(new Error("Database error"))),
      },
    }));

    // Make the request
    const pipelineRoute = (await import("./pipeline")).default;
    const { tursoClient } = await import("../helpers/turso-client");
    const app = new Hono<HonoPinoEnv>()
      .use(registerLogger)
      .use(appendLoggerInfo);
    app.route("/v2/pipeline", pipelineRoute);

    const req = await app.request("/v2/pipeline", {
      method: "POST",
      headers: {
        Authorization: "Bearer 123abcMock",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            type: "execute",
            stmt: "SELECT * FROM test",
          },
        ],
      }),
    });

    // Assertions
    expect(req.status).toBe(500);
    const response = await req.json();
    expect(response).toEqual({
      error: {
        message: "Database error",
        code: "INTERNAL_ERROR",
      },
    });
    expect(tursoClient.execute).toHaveBeenCalledTimes(1);
  });
});
