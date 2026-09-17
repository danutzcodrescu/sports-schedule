import { createDb } from "../db";
import { favouriteTeam, followedLeague } from "../db/app-schema";
import { refreshLeagueEvents } from "../services/sportsdb";
import { union } from "drizzle-orm/sqlite-core";

export async function refreshEventCaches(env: CloudflareBindings) {
  const db = createDb(env.DB);
  const leagues = await union(
    db.select({ leagueId: followedLeague.leagueId }).from(followedLeague),
    db.select({ leagueId: favouriteTeam.leagueId }).from(favouriteTeam),
  );
  const failedLeagueIds: string[] = [];

  for (const { leagueId } of leagues) {
    try {
      await refreshLeagueEvents(env.SPORTS_CACHE, env.SPORTSDB_API_KEY, leagueId);
    } catch (error) {
      failedLeagueIds.push(leagueId);
      console.error("Failed to refresh event cache", { leagueId, error });
    }
  }

  console.log("Event cache refresh completed", {
    refreshed: leagues.length - failedLeagueIds.length,
    failed: failedLeagueIds.length,
  });

  if (failedLeagueIds.length > 0) {
    throw new Error(`Failed to refresh event caches for leagues: ${failedLeagueIds.join(", ")}`);
  }
}
