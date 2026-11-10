import { queryClient } from "#/lib/queryClient";
import { captureRouteError, initializeSentry, sentryErrorHandlers } from "#/lib/sentry";
import { routeTree } from "./routeTree.gen";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

const sentryEnabled = initializeSentry();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultOnCatch: sentryEnabled ? captureRouteError : undefined,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement, sentryEnabled ? sentryErrorHandlers : undefined);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
