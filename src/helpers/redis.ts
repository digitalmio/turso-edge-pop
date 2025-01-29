import Redis from "ioredis";
import { env } from "./env";
import { tursoClient } from "./turso-client";

// why 2 instances?
// - _redisPub_ is used for publishing sync events
// - _redisSub_ is used for subscribing to sync events
//
// This is redis limitation:
// "Once the client enters the subscribed state it is not supposed to issue any other commands,
// except for additional SUBSCRIBE, PSUBSCRIBE, UNSUBSCRIBE and PUNSUBSCRIBE commands.
// https://redis.io/docs/latest/commands/subscribe/

export const redisSub = env.REDIS_CONNECTION_STRING
  ? new Redis(env.REDIS_CONNECTION_STRING)
  : null;

export const redisPub = env.REDIS_CONNECTION_STRING
  ? new Redis(env.REDIS_CONNECTION_STRING)
  : null;

export const publishRedisSyncCommand = async () => {
  if (redisPub) {
    redisPub.publish(env.REDIS_SYNC_CHANNEL, "sync");
  } else {
    await tursoClient.sync();
  }
};
