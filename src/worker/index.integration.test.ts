// @vitest-environment node
import worker from "./index";
import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
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
