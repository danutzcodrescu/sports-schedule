import { requireAuth } from "../auth/middleware";
import { createDb } from "../db";
import { followedLeague, league } from "../db/app-schema";
import { rateLimitMutation, rateLimitRead } from "../rate-limit";
import {
  applyLeagueRemoval,
  followLeagueStatements,
  planLeagueRemoval,
  TeamMembershipCheckError,
} from "../services/league-removal";
import { getLeagueDetails } from "../services/sportsdb";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AppEnv } from "../auth/middleware";
import type { LeagueDetails } from "../services/sportsdb";
import type { Context } from "hono";

type FollowLeagueBody = {
  leagueId?: unknown;
};

function isIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every((id) => typeof id === "string" && /^\d+$/.test(id))
  );
}

function membershipFailureResponse(c: Context<AppEnv>, error: unknown) {
  if (!(error instanceof TeamMembershipCheckError)) throw error;
  console.error("Failed to check team memberships", { error });
  return c.json(
    {
      error: "Could not check team memberships. Nothing was removed.",
      code: "TEAM_MEMBERSHIP_CHECK_FAILED",
    },
    502,
  );
}

async function removeLeagues(
  c: Context<AppEnv>,
  leagueIds: string[],
  confirmedTeamIds: string[],
  additionalLeagueIds: string[] = [],
) {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  let plan;
  try {
    // Recompute on commit so a stale preview can never silently delete extra favourites.
    plan = await planLeagueRemoval(
      db,
      c.env.SPORTS_CACHE,
      c.env.SPORTSDB_API_KEY,
      userId,
      leagueIds,
      additionalLeagueIds,
    );
  } catch (error) {
    return membershipFailureResponse(c, error);
  }
  const expected = new Set(confirmedTeamIds);
  if (plan.teamsToRemove.some((team) => !expected.has(team.teamId))) {
    return c.json(
      { error: "Confirm the affected favourite teams", teams: plan.teamsToRemove },
      409,
    );
  }
  const additionalLeagues: LeagueDetails[] = [];
  try {
    for (const leagueId of new Set(additionalLeagueIds)) {
      const details = await getLeagueDetails(c.env.SPORTS_CACHE, c.env.SPORTSDB_API_KEY, leagueId);
      if (!details) return c.json({ error: "League not found" }, 404);
      additionalLeagues.push(details);
    }
  } catch (error) {
    console.error("Failed to validate league additions", { error });
    return c.json({ error: "Could not check league additions. Nothing was changed." }, 502);
  }
  // No preferences are persisted before confirmation, including league additions.
  await applyLeagueRemoval(db, userId, plan, additionalLeagues);
  return c.body(null, 204);
}

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
      console.warn("Invalid follow league request");
      return c.json({ error: "Invalid league" }, 400);
    }

    let details;

    try {
      details = await getLeagueDetails(c.env.SPORTS_CACHE, c.env.SPORTSDB_API_KEY, body.leagueId);
    } catch (error) {
      console.error("Failed to fetch league details from TheSportsDB", {
        leagueId: body.leagueId,
        error,
      });
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    if (!details) {
      console.warn("League not found in TheSportsDB", { leagueId: body.leagueId });
      return c.json({ error: "League not found" }, 404);
    }

    const db = createDb(c.env.DB);

    await db.batch(followLeagueStatements(db, c.get("user").id, details));

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
  .post("/removal-preview", rateLimitRead, async (c) => {
    const body = await c.req
      .json<{ leagueIds?: unknown; additionalLeagueIds?: unknown }>()
      .catch(() => null);
    const additionalLeagueIds = body?.additionalLeagueIds ?? [];
    if (!body || !isIdList(body.leagueIds) || !isIdList(additionalLeagueIds)) {
      return c.json({ error: "Invalid leagues" }, 400);
    }
    try {
      const plan = await planLeagueRemoval(
        createDb(c.env.DB),
        c.env.SPORTS_CACHE,
        c.env.SPORTSDB_API_KEY,
        c.get("user").id,
        body.leagueIds,
        additionalLeagueIds,
      );
      c.header("Cache-Control", "no-store");
      return c.json({ teams: plan.teamsToRemove });
    } catch (error) {
      return membershipFailureResponse(c, error);
    }
  })
  .delete("/", rateLimitMutation, async (c) => {
    const body = await c.req
      .json<{ leagueIds?: unknown; confirmedTeamIds?: unknown; additionalLeagueIds?: unknown }>()
      .catch(() => null);
    const confirmedTeamIds = body?.confirmedTeamIds ?? [];
    const additionalLeagueIds = body?.additionalLeagueIds ?? [];
    const leagueIds = body?.leagueIds;
    if (
      !body ||
      !isIdList(leagueIds) ||
      !isIdList(confirmedTeamIds) ||
      !isIdList(additionalLeagueIds)
    ) {
      return c.json({ error: "Invalid removal" }, 400);
    }
    if (additionalLeagueIds.some((id) => leagueIds.includes(id)))
      return c.json({ error: "Cannot add and remove the same league" }, 400);
    return removeLeagues(c, leagueIds, confirmedTeamIds, additionalLeagueIds);
  })
  .delete("/:leagueId", rateLimitMutation, async (c) => {
    const leagueId = c.req.param("leagueId");

    if (!/^\d+$/.test(leagueId)) {
      console.warn("Invalid league ID parameter", { endpoint: "unfollow", leagueId });
      return c.json({ error: "Invalid league ID" }, 400);
    }

    const body = await c.req
      .json<{ confirmedTeamIds?: unknown }>()
      .catch(() => ({ confirmedTeamIds: [] }));
    const confirmedTeamIds = body?.confirmedTeamIds ?? [];
    if (!body || !isIdList(confirmedTeamIds)) return c.json({ error: "Invalid confirmation" }, 400);
    return removeLeagues(c, [leagueId], confirmedTeamIds);
  });
