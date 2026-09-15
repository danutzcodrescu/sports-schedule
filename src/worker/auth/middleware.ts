import { createAuth } from "./auth";
import { createMiddleware } from "hono/factory";

import type { Auth } from "./auth";

type AuthSession = Auth["$Infer"]["Session"];

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    session: AuthSession["session"];
    user: AuthSession["user"];
  };
};

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session.session);
  c.set("user", session.user);

  await next();
});
