// @vitest-environment node
import worker from "./index";
import { beforeEach, expect, test, vi } from "vitest";

import type * as WorkerSentry from "./sentry";
import type { ErrorEvent } from "@sentry/cloudflare";

const { beforeSend, sendEvent, refreshEventCaches } = vi.hoisted(() => ({
  beforeSend: vi.fn((event: ErrorEvent) => event),
  sendEvent: vi.fn(async (_envelope: unknown) => ({ statusCode: 200 })),
  refreshEventCaches: vi.fn(),
}));

vi.mock("./sentry", async (importOriginal) => {
  const actual = await importOriginal<typeof WorkerSentry>();
  return {
    workerSentryOptions: (env: CloudflareBindings) => ({
      ...actual.workerSentryOptions(env),
      // Each test uses different bindings, unlike requests within a deployed isolate.
      cacheClient: false,
      beforeSend,
      transport: () => ({ send: sendEvent, flush: async () => true }),
    }),
  };
});
vi.mock("./jobs/refresh-event-caches", () => ({ refreshEventCaches }));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  beforeSend.mockClear();
  sendEvent.mockClear();
  refreshEventCaches.mockReset();
});

function environment(flag: string | null) {
  const get = vi.fn(async () => flag);
  const limit = vi.fn(async () => ({ success: true }));
  const assets = vi.fn(async () => new Response("signup page"));
  const env = {
    FEATURE_FLAGS: { get },
    API_RATE_LIMITER: { limit },
    GENERAL_RATE_LIMITER: { limit },
    SIGN_UP_RATE_LIMITER: { limit },
    ASSETS: { fetch: assets },
  } as unknown as CloudflareBindings;
  return { env, get, limit, assets };
}

test.each(["true", "false", null, "TRUE", "1"])(
  "signup status exposes only the exact enabled flag (%s), without caching",
  async (flag) => {
    const { env, get, limit } = environment(flag);
    const response = await worker.fetch(new Request("https://example.test/api/signup-status"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: flag === "true" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(get).toHaveBeenCalledWith("signup-enabled");
    expect(limit).toHaveBeenCalledTimes(1);
  },
);

test("disabled signup still redirects direct page visits and rejects registration submissions", async () => {
  const { env, assets } = environment("false");
  const page = await worker.fetch(new Request("https://example.test/signup"), env);
  expect(page.status).toBe(302);
  expect(page.headers.get("Location")).toBe("/signin");
  expect(assets).not.toHaveBeenCalled();

  const submission = await worker.fetch(
    new Request("https://example.test/api/auth/sign-up/email", { method: "POST" }),
    env,
  );
  expect(submission.status).toBe(403);
  expect(await submission.json()).toEqual({ error: "Signup is disabled" });
});

test("enabled signup serves the page and a later flag change is reflected in status", async () => {
  const { env, get } = environment("true");
  const page = await worker.fetch(new Request("https://example.test/signup"), env);
  expect(await page.text()).toBe("signup page");
  const before = await worker.fetch(new Request("https://example.test/api/signup-status"), env);
  expect(await before.json()).toEqual({ enabled: true });
  get.mockResolvedValue("false");
  const after = await worker.fetch(new Request("https://example.test/api/signup-status"), env);
  expect(await after.json()).toEqual({ enabled: false });
});

test.each([false, true])(
  "request errors preserve the response and report only with a DSN (%s)",
  async (enabled) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { env, get } = environment("true");
    env.SENTRY_DSN = enabled ? "https://public@example.test/1" : undefined;
    const error = new Error("Feature flag lookup failed");
    get.mockRejectedValueOnce(error);
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const context = {
      waitUntil,
      passThroughOnException: vi.fn(),
      props: {},
      exports: {},
    } as unknown as ExecutionContext;

    const response = await worker.fetch(
      new Request("https://example.test/api/signup-status?token=private-query", {
        headers: {
          authorization: "Bearer private-auth",
          cookie: "session=private-cookie",
        },
      }),
      env,
      context,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));

    expect(sendEvent).toHaveBeenCalledTimes(enabled ? 1 : 0);
    const sent = JSON.stringify(sendEvent.mock.calls);
    expect(sent).not.toContain("private-query");
    expect(sent).not.toContain("private-auth");
    expect(sent).not.toContain("private-cookie");
    if (enabled) {
      expect(beforeSend).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ originalException: error }),
      );
    }
  },
);

test("scheduled job failures are reported and still reject", async () => {
  const { env } = environment("true");
  env.SENTRY_DSN = "https://public@example.test/1";
  const error = new Error("Event refresh failed");
  refreshEventCaches.mockRejectedValueOnce(error);
  const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
  const context = {
    waitUntil,
    passThroughOnException: vi.fn(),
    props: {},
    exports: {},
  } as unknown as ExecutionContext;
  const controller = { cron: "0 0 * * *", scheduledTime: Date.now(), noRetry: vi.fn() };

  await expect(worker.scheduled(controller, env, context)).rejects.toThrow(error);
  await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));
  expect(refreshEventCaches).toHaveBeenCalledWith(
    expect.objectContaining({ SENTRY_DSN: env.SENTRY_DSN }),
  );
  expect(beforeSend).toHaveBeenCalledTimes(1);
  expect(sendEvent).toHaveBeenCalledTimes(1);
  expect(beforeSend).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ originalException: error }),
  );
});
