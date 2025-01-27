import { Hono } from "hono";
import { tursoClient } from "../helpers/turso";
import { verifyClientAuth } from "../middlewares/auth";

const route = new Hono();

// This only makes sense if you can call selected server instance directly.
// Fly.io is using Anycast to direct your call to closest machine
route.get("/", verifyClientAuth, async (c) => {
  try {
    const syncData = await tursoClient.sync();
    return c.json({
      frameNo: syncData?.frame_no ?? null,
      framesSynced: syncData?.frames_synced ?? null,
    });
  } catch {
    return c.json(
      {
        error: {
          message: "Sync Error",
          code: "INTERNAL_ERROR",
        },
      },
      500,
    );
  }
});

export default route;
