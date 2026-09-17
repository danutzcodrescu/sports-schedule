import { requireAuth } from "../auth/middleware";
import { createDb } from "../db";
import { favouriteTeam, followedLeague } from "../db/app-schema";
import { rateLimitMutation, rateLimitRead } from "../rate-limit";
import { getLeagueTeams } from "../services/sportsdb";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AppEnv } from "../auth/middleware";

type TeamSelection = { teamId: string; leagueId: string };

function isTeamSelection(value: unknown): value is TeamSelection {
  if (!value || typeof value !== "object") return false;
  return (
    "teamId" in value &&
    typeof value.teamId === "string" &&
    /^\d+$/.test(value.teamId) &&
    "leagueId" in value &&
    typeof value.leagueId === "string" &&
    /^\d+$/.test(value.leagueId)
  );
}

export const favouriteTeamsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", rateLimitRead, async (c) => {
    const teams = await createDb(c.env.DB)
      .select({
        teamId: favouriteTeam.teamId,
        leagueId: favouriteTeam.leagueId,
        teamName: favouriteTeam.teamName,
        country: favouriteTeam.country,
        badgeUrl: favouriteTeam.badgeUrl,
      })
      .from(favouriteTeam)
      .where(eq(favouriteTeam.userId, c.get("user").id))
      .orderBy(favouriteTeam.createdAt, favouriteTeam.teamName);
    return c.json({ teams });
  })
  .put("/", rateLimitMutation, async (c) => {
    const body = await c.req.json<{ teams?: unknown }>().catch(() => null);
    if (
      !body ||
      !Array.isArray(body.teams) ||
      body.teams.length > 200 ||
      !body.teams.every(isTeamSelection)
    ) {
      return c.json({ error: "Invalid teams (maximum 200)" }, 400);
    }

    const selections = [...new Map(body.teams.map((team) => [team.teamId, team])).values()];
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const [existing, leagues] = await Promise.all([
      db.select().from(favouriteTeam).where(eq(favouriteTeam.userId, userId)),
      db.select().from(followedLeague).where(eq(followedLeague.userId, userId)),
    ]);
    const existingById = new Map(existing.map((team) => [team.teamId, team]));
    const followedIds = new Set(leagues.map((league) => league.leagueId));
    const additions = selections.filter((team) => !existingById.has(team.teamId));
    if (additions.some((team) => !followedIds.has(team.leagueId))) {
      return c.json({ error: "Follow the team's league first" }, 400);
    }

    // Resolve names and badges on the server, using the same cached catalogue as the picker.
    const catalogues = new Map<string, Awaited<ReturnType<typeof getLeagueTeams>>["teams"]>();
    try {
      for (const leagueId of new Set(additions.map((team) => team.leagueId))) {
        const result = await getLeagueTeams(c.env.SPORTS_CACHE, c.env.SPORTSDB_API_KEY, leagueId);
        catalogues.set(leagueId, result.teams);
      }
    } catch (error) {
      console.error("Failed to validate favourite teams", { error });
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    const values: (typeof favouriteTeam.$inferInsert)[] = [];
    for (const selection of selections) {
      const saved = existingById.get(selection.teamId);
      if (saved) {
        values.push(saved);
        continue;
      }
      const team = catalogues
        .get(selection.leagueId)
        ?.find((team) => team.idTeam === selection.teamId);
      if (!team) return c.json({ error: "Team not found in this league" }, 400);
      values.push({
        userId,
        teamId: team.idTeam,
        leagueId: selection.leagueId,
        teamName: team.strTeam,
        country: team.strCountry,
        badgeUrl: team.strBadge,
      });
    }

    // One batch keeps multi-league changes atomic. Individual inserts stay within bind limits.
    await db.batch([
      db.delete(favouriteTeam).where(eq(favouriteTeam.userId, userId)),
      ...values.map((team) => db.insert(favouriteTeam).values(team)),
    ]);
    return c.json({ saved: true });
  });
