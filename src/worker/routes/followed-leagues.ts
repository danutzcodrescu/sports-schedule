import { requireAuth } from "../auth/middleware";
import { createDb } from "../db";
import { followedLeague, league } from "../db/app-schema";
import { rateLimitMutation, rateLimitRead } from "../rate-limit";
import { getLeagueDetails } from "../services/sportsdb";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AppEnv } from "../auth/middleware";

type FollowLeagueBody = {
  leagueId?: unknown;
};

export const followedLeaguesRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", rateLimitRead, async (c) => {
    const leagues = await createDb(c.env.DB)
      .select({
        leagueId: followedLeague.leagueId,
        leagueName: league.name,
        sportName: league.sportName,
        country: league.country,
        badgeUrl: league.badgeUrl,
      })
      .from(followedLeague)
      .innerJoin(league, eq(followedLeague.leagueId, league.id))
      .where(eq(followedLeague.userId, c.get("user").id))
      .orderBy(followedLeague.createdAt);

    return c.json({ leagues });
  })
  .post("/", rateLimitMutation, async (c) => {
    const body = await c.req.json<FollowLeagueBody>().catch(() => null);

    if (!body || typeof body.leagueId !== "string" || !/^\d+$/.test(body.leagueId)) {
      return c.json({ error: "Invalid league" }, 400);
    }

    let details;

    try {
      details = await getLeagueDetails(c.env.SPORTS_CACHE, c.env.SPORTSDB_API_KEY, body.leagueId);
    } catch {
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    if (!details) {
      return c.json({ error: "League not found" }, 404);
    }

    const db = createDb(c.env.DB);

    await db
      .insert(league)
      .values({
        id: details.id,
        name: details.name,
        sportName: details.sportName,
        country: details.country,
        badgeUrl: details.badgeUrl,
        syncedAt: new Date(details.syncedAt),
      })
      .onConflictDoUpdate({
        target: league.id,
        set: {
          name: details.name,
          sportName: details.sportName,
          country: details.country,
          badgeUrl: details.badgeUrl,
          syncedAt: new Date(details.syncedAt),
        },
      });

    await db
      .insert(followedLeague)
      .values({
        userId: c.get("user").id,
        leagueId: details.id,
      })
      .onConflictDoNothing();

    return c.json(
      {
        league: {
          leagueId: details.id,
          leagueName: details.name,
          sportName: details.sportName,
          country: details.country,
          badgeUrl: details.badgeUrl,
        },
      },
      201,
    );
  })
  .delete("/:leagueId", rateLimitMutation, async (c) => {
    const leagueId = c.req.param("leagueId");

    if (!/^\d+$/.test(leagueId)) {
      return c.json({ error: "Invalid league ID" }, 400);
    }

    await createDb(c.env.DB)
      .delete(followedLeague)
      .where(
        and(eq(followedLeague.userId, c.get("user").id), eq(followedLeague.leagueId, leagueId)),
      );

    return c.body(null, 204);
  });
