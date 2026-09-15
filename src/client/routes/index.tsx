import { SportsDashboard } from "#/components/dashboard/SportsDashboard";
import { getFollowedLeagues } from "#/lib/api/sports";
import { authClient } from "#/lib/auth/auth.ts";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

const followedLeaguesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["followed-leagues", userId],
    queryFn: getFollowedLeagues,
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
  loader: ({ context }) =>
    context.queryClient.query({
      ...followedLeaguesQuery(context.session.user.id),
      staleTime: "static",
    }),
});

function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = Route.useRouteContext();
  const query = followedLeaguesQuery(session.user.id);
  const { data: leagues } = useSuspenseQuery(query);

  async function logOut() {
    await authClient.signOut();
    await navigate({ to: "/signin" });
  }

  return (
    <SportsDashboard
      userName={session.user.name}
      leagues={leagues}
      onLeaguesChanged={() => queryClient.invalidateQueries({ queryKey: query.queryKey })}
      onSignOut={logOut}
    />
  );
}
