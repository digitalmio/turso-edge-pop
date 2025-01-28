import Redis from "ioredis";
import { env } from "./env";

export const redis = env.REDIS_CONNECTION_STRING
  ? new Redis(env.REDIS_CONNECTION_STRING)
  : null;

export const publishRedisSyncCommand = () => {
  if (redis) {
    redis.publish(env.REDIS_SYNC_CHANNEL, "sync");
  }
};
