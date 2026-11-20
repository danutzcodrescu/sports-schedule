// @vitest-environment node
import { createTestDatabase } from "../test-fixtures";
import { refreshEventCaches } from "./refresh-event-caches";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let database: ReturnType<typeof createTestDatabase>;
let env: CloudflareBindings;
let writes: string[];

beforeEach(() => {
  database = createTestDatabase();
  const { sqlite } = database;
  sqlite.exec("INSERT INTO user (id, name, email) VALUES ('fan', 'Fan', 'fan@example.test')");
  for (let id = 1; id <= 20; id++) {
    sqlite
      .prepare("INSERT INTO league (id, name, sport_name) VALUES (?, ?, 'Soccer')")
      .run(String(id), `League ${id}`);
    sqlite
      .prepare("INSERT INTO followed_league (user_id, league_id) VALUES ('fan', ?)")
      .run(String(id));
  }
  sqlite.exec(
    "INSERT INTO favourite_team (user_id, team_id, league_id, team_name) VALUES ('fan', '10', '1', 'Team 10')",
  );
  writes = [];
  env = {
    DB: database.d1,
    SPORTSDB_API_KEY: "test",
    SPORTS_CACHE: {
      put: async (key: string) => {
        writes.push(key);
      },
    },
  } as unknown as CloudflareBindings;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => database.sqlite.close());

test("20 leagues with long Retry-After responses finish without waiting and still attempt healthy leagues", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async (url: URL) =>
    url.searchParams.get("id") === "20"
      ? Response.json({ events: [] })
      : new Response(null, { status: 503, headers: { "Retry-After": "30" } }),
  );
  vi.stubGlobal("fetch", fetch);
  try {
    const started = Date.now();
    await expect(refreshEventCaches(env)).rejects.toThrow("Failed to refresh event caches");
    expect(Date.now() - started).toBeLessThan(15 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(20);
    expect(new Set(fetch.mock.calls.map(([url]) => url.searchParams.get("id"))).size).toBe(20);
    expect(writes).toEqual(["sportsdb:events:20:v1"]);
  } finally {
    vi.useRealTimers();
  }
});

test("the job reports unattempted leagues before its overall deadline", async () => {
  let now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const fetch = vi.fn(async () => {
    now += 12 * 60 * 1000;
    return Response.json({ events: [] });
  });
  vi.stubGlobal("fetch", fetch);
  await expect(refreshEventCaches(env)).rejects.toThrow("Failed to refresh event caches");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(writes).toHaveLength(1);
  expect(console.log).toHaveBeenCalledWith("Event cache refresh completed", {
    refreshed: 1,
    failed: 19,
  });
});
