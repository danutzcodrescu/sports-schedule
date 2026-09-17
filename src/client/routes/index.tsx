import { SportsDashboard } from "#/components/dashboard/SportsDashboard";
import { getFavouriteTeams, getFollowedLeagues } from "#/lib/api/sports";
import { leagueEventsQuery } from "#/lib/api/sports-queries";
import { authClient } from "#/lib/auth/auth.ts";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

const followedLeaguesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["followed-leagues", userId],
    queryFn: getFollowedLeagues,
    staleTime: 30 * 1000,
  });

const favouriteTeamsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favourite-teams", userId],
    queryFn: getFavouriteTeams,
    staleTime: 30 * 1000,
  });

export const Route = createFileRoute("/")({
  component: Home,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      throw redirect({ to: "/signin" });
    }

    return { session };
  },
  loader: async ({ context }) => {
    const [leagues] = await Promise.all([
      context.queryClient.query(followedLeaguesQuery(context.session.user.id)),
      context.queryClient.query(favouriteTeamsQuery(context.session.user.id)),
    ]);

    // Favourites can play in multiple followed competitions, so warm every league's schedule.
    await Promise.all(
      leagues.map((league) =>
        context.queryClient.query(leagueEventsQuery(league.leagueId)).catch(() => undefined),
      ),
    );
  },
});

function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = Route.useRouteContext();
  const query = followedLeaguesQuery(session.user.id);
  const { data: leagues } = useSuspenseQuery(query);
  const teamsQuery = favouriteTeamsQuery(session.user.id);
  const { data: favouriteTeams } = useSuspenseQuery(teamsQuery);

  async function logOut() {
    await authClient.signOut();
    await navigate({ to: "/signin" });
  }

  return (
    <SportsDashboard
      key={session.user.id}
      userName={session.user.name}
      leagues={leagues}
      favouriteTeams={favouriteTeams}
      onTeamsChanged={() => queryClient.invalidateQueries({ queryKey: teamsQuery.queryKey })}
      onLeaguesChanged={() => queryClient.invalidateQueries({ queryKey: query.queryKey })}
      onSignOut={logOut}
    />
  );
}
