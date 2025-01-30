# Turso Edge POP

Turso Edge Point of Presence. Something between a proxy and an HTTP database server. Written in TypeScript using [Bun](https://bun.sh/) and [Hono](https://hono.dev/).

On start, it creates a local database and syncs it with the origin Turso database. It stays up to date through interval sync (by default every 60 seconds) and can optionally listen for changes via Redis pub/sub to update the database as needed on top of the interval sync.

Turso Edge POP supports HTTP requests only.

This project started as a Bun/Hono rewrite of the [Turso CDN](https://github.com/notrab/turso-cdn/blob/main/server.js) project and grew "a bit" from there.

Please note that this project is in its early stages. If you have found any bugs or have any suggestions, please open an issue or contact me directly on [X](https://x.com/mziehlke) or [Bluesky](https://bsky.app/profile/dmio.co).

## Motivation
Turso disabled Edge Replicas functionality and for new databases, you will not be able to replicate your data globally: https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap#simplifying-our-replication-model
I built this project to be able to simulate the original functionality whilst having more control over the data and sync process.

## Why are you using Bun not XYZ?
As a JS/TypeScript developer for this project, I was choosing between Bun and Deno as they can easily compile to a single executable file and are super fast. Both runtimes are great, but I chose Bun as I have more experience with it.

## How does it work?
Turso Edge POP is an HTTP server. On start, it runs by default on port 3000. It provides a handful of endpoints, but the most important ones are `POST /v2/pipeline`, `POST /v3/pipeline` and `POST /`.

Based on the request type, it will either proxy the request to the origin Turso database or query the local database using the official Turso LibSQL client. The SDK internally then decides if the query will be from the local or origin database.

The `/` endpoint statements are all executed against the local database via the LibSQL client.

The `/v2` and `/v3` endpoints are more complex. Turso Edge POP will run all `execute` and `close` statements locally. All other (mainly `batch`) statements are proxied to the origin database and returned without any changes back to the client.

The app also exposes a `/health` and `/version` informational endpoints. 

Lastly, you can use `/sync` endpoint to manually trigger a sync of the local database with the origin database.

## How to deploy? Where to host?
You will need to deploy POPs on your own infrastructure. The app requires some form of persistent storage to store the local database. The simplest option will be Fly.io - they offer an Anycast network so you do not need to worry about routing.

From my experience - any form of shared storage is not reliable enough for this, or any other database, use case. You will need a Block Storage solution or you can simply host it on the server disk space.

If you would like to host POPs on VPS, then you will need to manage GEO routing (so that the client can connect to the closest POP) yourself. This can be achieved by using DNS providers that offer GEO routing. I can recommend [GCore](https://gcore.com/dns), [ClouDNS](https://www.cloudns.net/geodns/) or [Bunny](https://bunny.net/dns/).

Full documentation is coming soon.

## Keeping the database in sync
If you are interested in this project, you probably would like to have multiple copies of your database in different regions of the world in sync.

The simplest way that works out of the box is interval sync. You can define via the env variable `TURSO_SYNC_INTERVAL` how often the local database will be synced with the origin database. If you do not set it up, it will be syncing every minute (60 seconds).

If this works for you, you can stop reading here.

If you would like to get updates on the database as they happen, you can use Redis pub/sub. This requires you to have a Redis server running and configured. The simplest way would most likely be to use [Upstash](https://upstash.com/) free tier.

You can set up Redis connection details via the env variable `REDIS_CONNECTION_STRING`. The app will subscribe to the channel defined by `REDIS_SYNC_CHANNEL`. By default, it is set to `sync`.
As long as the query that makes changes to the database is executed via the app, and client or proxy response indicates the change via `rowsAffected`, the app will publish a `sync` message to the channel. All servers that are subscribed to the channel will receive the message and will sync the database.

## Installation
In the future (very soon), you will be able to download a binary for your platform from the releases on Github. At the moment, you will need to run compilation yourself or run the code from source.
You will need to have [Bun](https://bun.sh/) installed on your machine. This will not be required in the future. The binary file will be self-contained and will be able to run without any additional dependencies.

The app does require connection and configuration details to run. You will need to provide them via environment variables. A full list of options as [Zod schema](https://zod.dev/) is available in the [env.ts](src/helpers/env.ts) file.

The main required options are:
- `TURSO_DATABASE_URL` - URL of the origin Turso database.
- `TURSO_AUTH_TOKEN` - Auth token for the origin Turso database.
- `PROXY_AUTH_TOKEN` - Auth token for the Turso Edge POP server.

Most likely, you will also need to provide a local database file path. By default, it is set to `/app/data/local.db` to fit Fly.io deployment. To amend this, please use the `DB_FILEPATH` environment variable.

If you prefer, you can store environment variables in a `.env` file in the root of the project / same folder as binary, but this is NOT recommended for production use.

To install dependencies:
```bash
bun install
```

To run app:
```bash
bun dev
```

This will start the app on port 3000.

### Building binary file
Please follow the instructions from https://bun.sh/docs/bundler/executables to build a binary file. 

Based on my use of MacOS and wanting to get a Linux binary, I would need to run the following commands from the root folder of the project:
```bash
bun build --compile --minify --sourcemap --target=bun-linux-x64-modern ./src/index.ts --outfile turso-edge-pop
```

This will create a binary file in the root folder of the project called `turso-edge-pop`. You will need to change the chmod of the file to make it executable.
```bash
chmod +x turso-edge-pop
```

and then you can run it:
```bash
./turso-edge-pop
```

---

**Note**: This is NOT an official Turso project and is not associated with Turso in any way. Turso Edge POP is an independent project that requires a Turso/LibSQL server to proxy and sync database requests.
