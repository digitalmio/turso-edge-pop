import debounce from "debounce";
import { env } from "../helpers/env";
import { logger } from "../helpers/logger";
import { redisSub } from "../helpers/redis";
import { tursoClientSync } from "../helpers/turso-client";

export let lastSyncTimestamp = 0;

export const syncJobPubsub = () => {
  if (redisSub) {
    // subscribe
    redisSub.subscribe(env.REDIS_SYNC_CHANNEL, (err, count) => {
      if (err) {
        logger.error(
          "Failed to subscribe to Redis %s channel: %s",
          env.REDIS_SYNC_CHANNEL,
          err.message,
        );
        throw new Error("Failed to subscribe to Redis pub/sub events", err);
      }
      logger.info(
        "Subscribed successfully to Redis pub/sub channel %s.",
        env.REDIS_SYNC_CHANNEL,
      );
    });

    // listen for messages
    redisSub.on("message", (channel, message) => {
      if (channel === env.REDIS_SYNC_CHANNEL && message === "sync") {
        debounce(async () => {
          logger.info(
            "Received 'sync' message on channel %s. Syncing database.",
            channel,
          );
          await tursoClientSync("pubsub");
          lastSyncTimestamp = Math.floor(Date.now() / 1000);
        }, env.REDIS_SYNC_DEBOUNCE * 1000);
      }
    });
  }
};
