import { createAuth } from "./auth/auth";
import { refreshEventCaches } from "./jobs/refresh-event-caches";
import { rateLimitApi, rateLimitAuth } from "./rate-limit";
import { favouriteTeamsRoutes } from "./routes/favourite-teams";
import { followedLeaguesRoutes } from "./routes/followed-leagues";
import { sportsRoutes } from "./routes/sports";
import { Hono } from "hono";
import { logger } from "hono/logger";

import type { AppEnv } from "./auth/middleware";

const SIGNUP_FEATURE_FLAG = "signup-enabled";

function isSignupEnabled(env: CloudflareBindings) {
  return env.FEATURE_FLAGS.get(SIGNUP_FEATURE_FLAG).then((value) => value === "true");
}

const app = new Hono<AppEnv>()
  .use(logger())
  .on(["GET", "HEAD"], "/signup", async (c) => {
    if (!(await isSignupEnabled(c.env))) {
      return c.redirect("/signin", 302);
    }

    return c.env.ASSETS.fetch(c.req.raw);
  })
  .use("/api/*", rateLimitApi)
  .use("/api/auth/*", rateLimitAuth)
  .post("/api/auth/sign-up/email", async (c) => {
    if (!(await isSignupEnabled(c.env))) {
      return c.json({ error: "Signup is disabled" }, 403);
    }

    return createAuth(c.env).handler(c.req.raw);
  })
  .on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw))
  .get("/api/health", (c) => c.json({ status: "ok" }))
  .route("/api/followed-leagues", followedLeaguesRoutes)
  .route("/api/favourite-teams", favouriteTeamsRoutes)
  .route("/api/sports", sportsRoutes);

app.onError((error, c) => {
  console.error("Unhandled request error", {
    method: c.req.method,
    path: c.req.path,
    error,
  });

  return c.json({ error: "Internal server error" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, _ctx) {
    await refreshEventCaches(env);
  },
} satisfies ExportedHandler<CloudflareBindings>;
export type AppType = typeof app;
