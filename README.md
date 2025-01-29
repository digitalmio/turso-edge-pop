# Turso Edge POP

Stateless Turso Edge Point of Presence. Something between a proxy and a HTTP database server. Written in Typescript using [Bun](https://bun.sh/) and [Hono](https://hono.dev/).

On start it creates a local database and syncs it with the origin Turso database. It stays up to date through interval sync (by default every 60 seconds) and can optionally listen for changes via Redis pub/sub to update the database as needed on top of the interval sync.

Turso Edge POP support HTTP requests only.

Please note that this project is in early stages. If you found any bugs or have any suggestions, please open an issue or contact me directly on [X](https://x.com/mziehlke) or [Bluesky](https://bsky.app/profile/dmio.co).

## Motivation
Turso disabled Edge Replicas functionality and for new databases you won't be able to replicate your data globally. 
I built this project to be able to simulate this functionality while having more control over the data and sync process.

## Why Bun?
As JS/Typescript developer for this project I was choosing between Bun and Deno as they can easily compile to single executable file. Both runtimes are great, but I've chosen Bun as I have more experience with it.

## How it works?
Turso Edge POP is a HTTP server. On start it runs by default on port 3000. It provides handful of endpoints, but the most important ones are `POST /v2/pipeline`, `POST /v3/pipeline` and `POST /`.

Based on the request type, it will either proxy the request to the origin Turso database or query local database using official Turso LibSQL client. SDK internally then decides if query will be from the local or origin database.

The `/` endpoint statements are all executed against the local database via LibSQL client.

The `/v2` and `/v3` endpoints are more complex. Turso Edge POP will run all `execute` and `close` statements locally. All other (mainly `batch`) statements are proxied to the origin database and returned without any changes back to the client.

## Keeping the database in sync
If you are interested in this project, you probably would like to have multiple copies of your database in different regions of the world. In sync.

Simplest way that works out the of the box is interval sync. You can define via env variable `TURSO_SYNC_INTERVAL` how often the local database will be synced with the origin database. If you won't set it up, it'll be syncing every minute (60 seconds).

If this works for you, you can stop reading here.

If you would like to get updates on the database as they happen, you can use Redis pub/sub. This requires you to have Redis server running and configured. Most likely simplest way would be to use [Upstash](https://upstash.com/) free tier.

You can set up Redis connection details via env variable `REDIS_CONNECTION_STRING`. The app will subscribe to the channel defined by `REDIS_SYNC_CHANNEL`. By default it's set to `sync`.
As long as the query that makes change to the database is executed via the app, and client or proxy response will indicate the change via `rowsAffected`, app will publish `sync` message to the channel. All servers that are subscribed to the channel will receive the message and will sync the database.

## Installation
In the future (very soon) you'll be able to download a binary for your platform from the releases on Github. At the moment you'll need to run compilation yourself or run the code from source.
You'll need to have [Bun](https://bun.sh/) installed on your machine. This won't be required in the future. Binary file will be self-contained and will be able to run without any additional dependencies.

The app does require connection and configuration details to run. You'll need to provide them via environment variables. Full list of options as [Zod schema](https://zod.dev/) is available in the [env.ts](src/helpers/env.ts) file.

The main required options are:
- `TURSO_DATABASE_URL` - URL of the origin Turso database.
- `TURSO_AUTH_TOKEN` - Auth token for the origin Turso database.
- `PROXY_AUTH_TOKEN` - Auth token for the Turso Edge POP server.

Most likely, you'll also need to provide local database file path. By default it's set to `/app/data/local.db` to fit Fly.io deployment. To amend this, please use `DB_FILEPATH` environment variable.

If you prefer, you can store environment variables in `.env` file in the root of the project / same folder as binary, but this is NOT recommended for production use.

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

Based that I'm using MacOS and I'd like to get Linux binary, I'd need to run followinf commands from root folder of the project:
```bash
bun build --compile --minify --sourcemap --target=bun-linux-x64-modern ./src/index.ts --outfile turso-edge-pop
```

This will create a binary file in the root folder of the project called `turso-edge-pop`. You'll need to change chmod of the file to make it executable.
```bash
chmod +x turso-edge-pop
```

and then you can run it:
```bash
./turso-edge-pop
```

---

**Note**: This is NOT an official Turso project and is not associated with Turso in any way. Turso Edge POP is an independent project that requires a Turso/LibSQL server to proxy and sync database requests.
