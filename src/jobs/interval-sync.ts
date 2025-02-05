import { setIntervalAsync } from "set-interval-async";
import { env } from "../helpers/env";
import { tursoClientSync } from "../helpers/turso-client";

export const intervalSyncJob = async () => {
  await tursoClientSync("interval");

  setIntervalAsync(async () => {
    await tursoClientSync("interval");
  }, env.TURSO_SYNC_INTERVAL * 1000);
};
