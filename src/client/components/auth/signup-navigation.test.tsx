import { Route as SigninRoute } from "../../routes/signin";
import { Route as SignupRoute } from "../../routes/signup";
import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({ Turnstile: () => null }));

afterEach(cleanup);

async function openSignin() {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => <Outlet />,
  });
  const signin = createRoute({
    getParentRoute: () => root,
    path: "/signin",
    component: SigninRoute.options.component,
  });
  const signup = createRoute({
    getParentRoute: () => root,
    path: "/signup",
    component: SignupRoute.options.component,
    beforeLoad: SignupRoute.options.beforeLoad,
  });
  const router = createRouter({
    routeTree: root.addChildren([signin, signup]),
    history: createMemoryHistory({ initialEntries: ["/signin"] }),
    context: { queryClient: new QueryClient() },
    defaultHashScrollIntoView: false,
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Welcome back" });
  return router;
}

test("client navigation cannot display signup when the runtime flag is disabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ enabled: false })),
  );
  const router = await openSignin();

  await act(async () => {
    await router.navigate({ to: "/signup" });
  });

  expect(router.state.location.pathname).toBe("/signin");
  expect(screen.queryByRole("heading", { name: "Create an account" })).toBeNull();
});

test("signup navigation rechecks the runtime flag rather than reusing an enabled result", async () => {
  let enabled = true;
  const fetch = vi.fn(async () => Response.json({ enabled }));
  vi.stubGlobal("fetch", fetch);
  const router = await openSignin();

  await act(async () => {
    await router.navigate({ to: "/signup" });
  });
  expect(screen.getByRole("heading", { name: "Create an account" })).toBeTruthy();

  await act(async () => {
    await router.navigate({ to: "/signin" });
  });
  enabled = false;
  await act(async () => {
    await router.navigate({ to: "/signup" });
  });

  expect(router.state.location.pathname).toBe("/signin");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith("/api/signup-status", {
    credentials: "same-origin",
    cache: "no-store",
  });
});

test("signup stays hidden if the runtime flag cannot be checked", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  const router = await openSignin();

  await act(async () => {
    await router.navigate({ to: "/signup" });
  });

  expect(router.state.location.pathname).toBe("/signin");
});

test.each([null, {}, { enabled: "true" }])(
  "signup rejects malformed flag responses: %j",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(status)),
    );
    const router = await openSignin();
    await act(async () => {
      await router.navigate({ to: "/signup" });
    });
    expect(router.state.location.pathname).toBe("/signin");
  },
);

test("signup stays hidden after a network failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Offline");
    }),
  );
  const router = await openSignin();
  await act(async () => {
    await router.navigate({ to: "/signup" });
  });
  expect(router.state.location.pathname).toBe("/signin");
});
