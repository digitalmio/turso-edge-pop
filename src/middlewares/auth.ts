import { createMiddleware } from "hono/factory";

export const verifyClientAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // No token or malformed
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          message: "Missing or malformed Authorization header",
          code: "UNAUTHORIZED",
        },
      },
      401,
    );
  }

  // Invalid token
  if (authHeader.slice(7) !== process.env.PROXY_AUTH_TOKEN) {
    return c.json(
      {
        error: {
          message: "Invalid authorization token",
          code: "UNAUTHORIZED",
        },
      },
      401,
    );
  }

  // Run main hander function
  await next();
});
