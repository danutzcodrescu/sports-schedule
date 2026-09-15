import { createAuth } from "./auth/auth";
import { followedLeaguesRoutes } from "./routes/followed-leagues";
import { sportsRoutes } from "./routes/sports";
import { Hono } from "hono";

import type { AppEnv } from "./auth/middleware";

const app = new Hono<AppEnv>()
  .basePath("/api")
  .on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw))
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/followed-leagues", followedLeaguesRoutes)
  .route("/sports", sportsRoutes);

export default app;
export type AppType = typeof app;
