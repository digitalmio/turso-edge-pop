import packageJson from "../../package.json" assert { type: "json" };
import { env } from "./env";

export const region = env.REGION ?? env.FLY_REGION ?? "default";

export const appVersion = packageJson.version;
