import { favouriteTeam, followedLeague, league } from "../db/app-schema";
import { getLeagueTeams, getTeamLeagueIds } from "./sportsdb";
import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import type { LeagueDetails } from "./sportsdb";

export class TeamMembershipCheckError extends Error {}

export function followLeagueStatements(db: Db, userId: string, details: LeagueDetails) {
  const values = { ...details, syncedAt: new Date(details.syncedAt) };
  return [
    db.insert(league).values(values).onConflictDoUpdate({ target: league.id, set: values }),
    db.insert(followedLeague).values({ userId, leagueId: details.id }).onConflictDoNothing(),
  ] as const;
}

export async function planLeagueRemoval(
  db: Db,
  cache: KVNamespace,
  apiKey: string,
  userId: string,
  leagueIds: string[],
  additionalLeagueIds: string[] = [],
) {
  const [leagues, teams] = await Promise.all([
    db.select().from(followedLeague).where(eq(followedLeague.userId, userId)),
    db
      .select({
        teamId: favouriteTeam.teamId,
        leagueId: favouriteTeam.leagueId,
        teamName: favouriteTeam.teamName,
        country: favouriteTeam.country,
        badgeUrl: favouriteTeam.badgeUrl,
      })
      .from(favouriteTeam)
      .where(eq(favouriteTeam.userId, userId)),
  ]);
  const removedIds = new Set(leagueIds);
  const removals = leagues.filter((league) => removedIds.has(league.leagueId));
  const removedLeagueIds = new Set(removals.map((league) => league.leagueId));
  const remainingIds = new Set([
    ...leagues.map((league) => league.leagueId).filter((id) => !removedIds.has(id)),
    ...additionalLeagueIds.filter((id) => !removedIds.has(id)),
  ]);
  const memberships = new Map<string, Set<string>>();
  const unavailableLeagueIds = new Set<string>();

  // A saved league is positive membership evidence, not an exhaustive list.
  for (const team of teams) memberships.set(team.teamId, new Set([team.leagueId]));
  if (teams.length && removals.length) {
    // Read both primary and secondary competition IDs: cup catalogues can be null
    // even when a team's domestic catalogue identifies its cup membership.
    for (const leagueId of new Set([...removedLeagueIds, ...remainingIds])) {
      let catalogue;
      try {
        catalogue = await getLeagueTeams(cache, apiKey, leagueId);
      } catch (cause) {
        throw new TeamMembershipCheckError("Could not read a team catalogue", { cause });
      }
      if (!catalogue.hasCatalogue) unavailableLeagueIds.add(leagueId);
      for (const team of catalogue.teams) {
        const memberOf = memberships.get(team.idTeam);
        if (!memberOf) continue;
        memberOf.add(leagueId);
        for (const id of getTeamLeagueIds(team)) memberOf.add(id);
      }
    }
  }

  const teamsToRemove: typeof teams = [];
  const teamsToReassign: Array<{ teamId: string; leagueId: string }> = [];
  for (const team of teams) {
    const memberOf = memberships.get(team.teamId)!;
    if (![...removedLeagueIds].some((id) => memberOf.has(id))) continue;
    const remainingLeagueId = [...remainingIds].find((id) => memberOf.has(id));
    if (!remainingLeagueId) {
      // A null catalogue is unknown, not proof that a team is absent. Positive
      // membership evidence may protect a team, but uncertainty must never delete it.
      if ([...remainingIds].some((id) => unavailableLeagueIds.has(id))) {
        throw new TeamMembershipCheckError("Could not verify remaining league memberships");
      }
      teamsToRemove.push(team);
    } else if (removedLeagueIds.has(team.leagueId)) {
      teamsToReassign.push({ teamId: team.teamId, leagueId: remainingLeagueId });
    }
  }

  return { leagueIds: [...removedLeagueIds], teamsToRemove, teamsToReassign };
}

export async function applyLeagueRemoval(
  db: Db,
  userId: string,
  plan: Awaited<ReturnType<typeof planLeagueRemoval>>,
  additionalLeagues: LeagueDetails[] = [],
) {
  // D1 batches are atomic. Keep each statement below SQLite's bind limit.
  const statements = [
    ...additionalLeagues.flatMap((details) => followLeagueStatements(db, userId, details)),
    ...plan.teamsToRemove.map((team) =>
      db
        .delete(favouriteTeam)
        .where(and(eq(favouriteTeam.userId, userId), eq(favouriteTeam.teamId, team.teamId))),
    ),
    ...plan.teamsToReassign.map((team) =>
      db
        .update(favouriteTeam)
        .set({ leagueId: team.leagueId })
        .where(and(eq(favouriteTeam.userId, userId), eq(favouriteTeam.teamId, team.teamId))),
    ),
    ...plan.leagueIds.map((leagueId) =>
      db
        .delete(followedLeague)
        .where(and(eq(followedLeague.userId, userId), eq(followedLeague.leagueId, leagueId))),
    ),
  ];
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
}
