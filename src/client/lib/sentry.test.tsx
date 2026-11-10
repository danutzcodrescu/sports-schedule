import { captureRouteError, initializeSentry, sentryErrorHandlers } from "./sentry";
import * as Sentry from "@sentry/react";
import { act, waitFor } from "@testing-library/react";
import { Component } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import type { ReactNode } from "react";

const dsn = "https://public@example.test/1";

afterEach(async () => {
  vi.unstubAllEnvs();
  await Sentry.close();
});

test.each([false, true])(
  "an absent DSN disables browser monitoring (production: %s)",
  (production) => {
    const init = vi.spyOn(Sentry, "init").mockReturnValue(undefined);
    vi.stubEnv("PROD", production);
    vi.stubEnv("VITE_SENTRY_DSN", "");
    initializeSentry();
    expect(init).not.toHaveBeenCalled();
  },
);

test("development does not send browser events even with a DSN", () => {
  const init = vi.spyOn(Sentry, "init").mockReturnValue(undefined);
  vi.stubEnv("PROD", false);
  vi.stubEnv("VITE_SENTRY_DSN", dsn);
  initializeSentry();
  expect(init).not.toHaveBeenCalled();
});

test("production initializes error monitoring without collecting authentication data", () => {
  const init = vi.spyOn(Sentry, "init").mockReturnValue(undefined);
  vi.stubEnv("PROD", true);
  vi.stubEnv("MODE", "production");
  vi.stubEnv("VITE_SENTRY_DSN", dsn);
  initializeSentry();
  expect(init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn,
      environment: "production",
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    }),
  );
});

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <p>Something went wrong</p> : this.props.children;
  }
}

test.each(["caught", "uncaught", "route"])(
  "%s errors reach Sentry with the Redact runtime",
  async (kind) => {
    const beforeSend = vi.fn(() => null);
    Sentry.init({ dsn, defaultIntegrations: false, beforeSend });
    const error = new Error(`${kind} test failure`);
    function Broken(): ReactNode {
      throw error;
    }

    const container = document.createElement("div");
    const root = createRoot(container, sentryErrorHandlers);
    try {
      if (kind === "route") {
        captureRouteError(error);
      } else if (kind === "uncaught") {
        // act rethrows uncaught errors instead of invoking the root's error handler.
        root.render(<Broken />);
      } else {
        await act(() => {
          root.render(
            <Boundary>
              <Broken />
            </Boundary>,
          );
        });
      }

      await waitFor(() => expect(beforeSend).toHaveBeenCalledTimes(1));
      expect(beforeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: expect.objectContaining({
            values: expect.arrayContaining([expect.objectContaining({ value: error.message })]),
          }),
        }),
        expect.anything(),
      );
    } finally {
      await act(() => root.unmount());
    }
  },
);
