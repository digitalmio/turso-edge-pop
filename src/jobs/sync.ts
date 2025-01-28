import debounce from "debounce";
import { env } from "../helpers/env";
import { redis } from "../helpers/redis";
import { tursoClient } from "../helpers/turso";

export let lastSyncTimestamp = 0;

export const syncJob = () => {
  if (redis) {
    // subscribe
    redis.subscribe(env.REDIS_SYNC_CHANNEL, (err, count) => {
      if (err) {
        console.error(
          "Failed to subscribe to Redis %s channel: %s",
          env.REDIS_SYNC_CHANNEL,
          err.message,
        );
        throw new Error("Failed to subscribe to Redis pub/sub events", err);
      }
      console.log(
        "Subscribed successfully to Redis pub/sub channel %s.",
        env.REDIS_SYNC_CHANNEL,
      );
    });

    // listen for messages
    redis.on("message", (channel, message) => {
      if (channel === env.REDIS_SYNC_CHANNEL && message === "sync") {
        debounce(async () => {
          console.log(
            "Received 'sync' message on channel %s. Syncing database.",
            channel,
          );
          await tursoClient.sync();
          lastSyncTimestamp = Math.floor(Date.now() / 1000);
        }, env.REDIS_SYNC_DEBOUNCE * 1000);
      }
    });
  }
};
