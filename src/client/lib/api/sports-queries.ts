import { getLeagueEvents } from "./sports";
import { queryOptions } from "@tanstack/react-query";

export const leagueEventsQuery = (leagueId: string) =>
  queryOptions({
    queryKey: ["league-events", leagueId],
    queryFn: () => getLeagueEvents(leagueId),
    staleTime: 5 * 60 * 1000,
  });
