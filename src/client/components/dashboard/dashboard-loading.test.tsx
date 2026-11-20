import * as sports from "#/lib/api/sports";
import { authClient } from "#/lib/auth/auth";
import { Route as HomeRoute } from "../../routes/index";
import { makeLeague } from "./test-fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("#/lib/auth/auth", () => ({ authClient: { getSession: vi.fn() } }));

afterEach(cleanup);

test("the dashboard renders while event prefetches are still pending", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: {
      user: {
        id: "fan",
        name: "Fan",
        email: "fan@example.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session",
        token: "test-token",
        userId: "fan",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    error: null,
  });
  let finish!: (events: sports.SportsEvent[]) => void;
  vi.spyOn(sports, "getLeagueEvents").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["followed-leagues", "fan"], [makeLeague("1")]);
  client.setQueryData(["favourite-teams", "fan"], []);
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => <Outlet />,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    beforeLoad: HomeRoute.options.beforeLoad,
    loader: HomeRoute.options.loader,
    component: HomeRoute.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([home]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { queryClient: client },
    defaultHashScrollIntoView: false,
  });
  try {
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Your sports timeline" })).toBeTruthy();
    expect(client.getQueryState(["league-events", "1"])?.fetchStatus).toBe("fetching");
    expect(screen.getByRole("status").textContent).toContain("Loading events");
  } finally {
    finish?.([]);
    cleanup();
    client.clear();
  }
});
