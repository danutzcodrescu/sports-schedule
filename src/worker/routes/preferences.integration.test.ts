// @vitest-environment node
import { createAuth } from "../auth/auth";
import { createTestDatabase } from "../test-fixtures";
import { favouriteTeamsRoutes } from "./favourite-teams";
import { followedLeaguesRoutes } from "./followed-leagues";
import { sportsRoutes } from "./sports";
import { Hono } from "hono";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { AppEnv } from "../auth/middleware";

const app = new Hono<AppEnv>()
  .route("/api/favourite-teams", favouriteTeamsRoutes)
  .route("/api/followed-leagues", followedLeaguesRoutes)
  .route("/api/sports", sportsRoutes);

let database: ReturnType<typeof createTestDatabase>;
let env: CloudflareBindings;
let cookie: string;
let userId: string;
let entries: Map<string, unknown>;
let scoreCache: { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

function team(idTeam: string) {
  return {
    idTeam,
    idLeague: "1",
    strTeam: `Team ${idTeam}`,
    strSport: "Soccer",
    strLeague: "League 1",
    strCountry: null,
    strBadge: null,
  };
}

beforeEach(async () => {
  database = createTestDatabase();
  entries = new Map([
    ["sportsdb:teams:1:v2", { teams: [team("10"), team("20"), team("30")] }],
    ["sportsdb:teams:2:v2", { teams: [] }],
  ]);
  const limit = async () => ({ success: true });
  env = {
    DB: database.d1,
    BETTER_AUTH_SECRET: "test-only-auth-secret-at-least-32-characters-long",
    BETTER_AUTH_URL: "https://example.test",
    TURNSTILE_SECRET_KEY: "test-only-captcha-secret",
    SPORTSDB_API_KEY: "test",
    SPORTS_CACHE: {
      get: async (key: string) => entries.get(key) ?? null,
      put: async (key: string, value: string) => {
        entries.set(key, JSON.parse(value));
      },
    },
    GENERAL_RATE_LIMITER: { limit },
    MUTATION_RATE_LIMITER: { limit },
    SPORTS_RATE_LIMITER: { limit },
  } as unknown as CloudflareBindings;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => Response.json({ success: true })),
  );
  const signup = await createAuth(env).api.signUpEmail({
    body: { email: "fan@example.test", name: "Fan", password: "test-password-123" },
    headers: new Headers({ "x-captcha-response": "test-token" }),
    asResponse: true,
  });
  expect(signup.status).toBe(200);
  userId = ((await signup.json()) as { user: { id: string } }).user.id;
  cookie = signup.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  database.sqlite.exec(`
    INSERT INTO user (id, name, email) VALUES ('other', 'Other', 'other@example.test');
    INSERT INTO league (id, name, sport_name) VALUES ('1', 'League 1', 'Soccer'), ('2', 'League 2', 'Soccer');
  `);
  database.sqlite
    .prepare(
      "INSERT INTO followed_league (user_id, league_id) VALUES (?, '1'), (?, '2'), ('other', '1')",
    )
    .run(userId, userId);
  vi.mocked(fetch).mockReset().mockRejectedValue(new Error("Unexpected provider request"));

  const scores = new Map<string, { response: Response; expiresAt: number }>();
  scoreCache = {
    match: vi.fn(async (key: Request) => {
      const cached = scores.get(key.url);
      return cached && cached.expiresAt > Date.now() ? cached.response.clone() : undefined;
    }),
    put: vi.fn(async (key: Request, response: Response) => {
      scores.set(key.url, { response: response.clone(), expiresAt: Date.now() + 30_000 });
    }),
  };
  vi.stubGlobal("caches", { open: async () => scoreCache });
});

afterEach(() => database.sqlite.close());

function request(path: string, method = "GET", body?: unknown, sessionCookie = cookie) {
  return app.request(
    `https://example.test${path}`,
    {
      method,
      headers: { cookie: sessionCookie, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}

function favourite(teamId: string, owner = userId) {
  database.sqlite
    .prepare(
      "INSERT INTO favourite_team (user_id, team_id, league_id, team_name) VALUES (?, ?, '1', ?)",
    )
    .run(owner, teamId, `Team ${teamId}`);
}

function savedTeams() {
  return database.sqlite
    .prepare("SELECT team_id FROM favourite_team WHERE user_id = ? ORDER BY team_id")
    .all(userId)
    .map((row) => row.team_id);
}

test.each(["/api/favourite-teams", "/api/followed-leagues", "/api/sports"])(
  "real authentication rejects missing and invalid sessions: %s",
  async (path) => {
    expect((await request(path, "GET", undefined, "")).status).toBe(401);
    expect(
      (await request(path, "GET", undefined, "better-auth.session_token=forged.signature")).status,
    ).toBe(401);
  },
);

test("delta saves do not restore removed teams or overwrite another tab's additions", async () => {
  favourite("10");
  favourite("20");
  favourite("10", "other");
  expect(
    (await request("/api/favourite-teams", "PATCH", { additions: [], removedTeamIds: ["10"] }))
      .status,
  ).toBe(200);
  expect(
    (
      await request("/api/favourite-teams", "PATCH", {
        additions: [{ teamId: "30", leagueId: "1" }],
        removedTeamIds: [],
      })
    ).status,
  ).toBe(200);
  expect(savedTeams()).toEqual(["20", "30"]);
  expect(
    (await request("/api/favourite-teams", "PATCH", { additions: [], removedTeamIds: ["20"] }))
      .status,
  ).toBe(200);
  expect(savedTeams()).toEqual(["30"]);
  expect(
    database.sqlite.prepare("SELECT team_id FROM favourite_team WHERE user_id = 'other'").all(),
  ).toEqual([{ team_id: "10" }]);
  const response = await request("/api/favourite-teams");
  expect(await response.json()).toMatchObject({ teams: [{ teamId: "30", teamName: "Team 30" }] });
});

test.each([
  { teams: [] },
  { additions: [null], removedTeamIds: [] },
  { additions: [{ teamId: "bad", leagueId: "1" }], removedTeamIds: [] },
  { additions: [], removedTeamIds: [null] },
  { additions: [], removedTeamIds: Array(201).fill("10") },
  { additions: [{ teamId: "10", leagueId: "1" }], removedTeamIds: ["10"] },
  { additions: [{ teamId: "999", leagueId: "1" }], removedTeamIds: ["10"] },
  { additions: [{ teamId: "30", leagueId: "3" }], removedTeamIds: ["10"] },
])("invalid changes leave saved favourites untouched: %j", async (body) => {
  favourite("10");
  expect((await request("/api/favourite-teams", "PATCH", body)).status).toBe(400);
  expect(savedTeams()).toEqual(["10"]);
});

test("the combined favourite list cannot exceed 200 teams", async () => {
  for (let index = 0; index < 200; index++) favourite(String(index + 1000));
  const response = await request("/api/favourite-teams", "PATCH", {
    additions: [{ teamId: "30", leagueId: "1" }],
    removedTeamIds: [],
  });
  expect(response.status).toBe(400);
  expect(savedTeams()).toHaveLength(200);
});

test("provider and database failures never persist partial removals", async () => {
  favourite("10");
  const changes = { additions: [{ teamId: "30", leagueId: "1" }], removedTeamIds: ["10"] };
  entries.delete("sportsdb:teams:1:v2");
  expect((await request("/api/favourite-teams", "PATCH", changes)).status).toBe(502);
  expect(savedTeams()).toEqual(["10"]);
  entries.set("sportsdb:teams:1:v2", { teams: [team("30")] });
  database.sqlite.exec(
    "CREATE TRIGGER prevent_team_addition BEFORE INSERT ON favourite_team BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  expect((await request("/api/favourite-teams", "PATCH", changes)).status).toBe(500);
  expect(savedTeams()).toEqual(["10"]);
  expect(database.sqlite.prepare("SELECT * FROM preference_revision").all()).toEqual([]);
});

test("unfollowing a league during team validation rejects the stale favourite write", async () => {
  env.SPORTS_CACHE = {
    get: async (key: string) => {
      if (key === "sportsdb:teams:1:v2") {
        expect((await request("/api/followed-leagues/1", "DELETE")).status).toBe(204);
      }
      return entries.get(key) ?? null;
    },
    put: async () => {},
  } as unknown as KVNamespace;
  const response = await request("/api/favourite-teams", "PATCH", {
    additions: [{ teamId: "30", leagueId: "1" }],
    removedTeamIds: [],
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "PREFERENCES_CHANGED" });
  expect(savedTeams()).toEqual([]);
});

test("live scores are shared across viewers for 30 seconds without browser caching", async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ success: true }));
  const viewer = await createAuth(env).api.signUpEmail({
    body: { email: "viewer@example.test", name: "Viewer", password: "test-password-123" },
    headers: new Headers({ "x-captcha-response": "test-token" }),
    asResponse: true,
  });
  expect(viewer.status).toBe(200);
  const viewerCookie = viewer.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  vi.mocked(fetch).mockClear();
  const score = { idEvent: "123", intHomeScore: null, intAwayScore: "2", strStatus: "2H" };
  vi.mocked(fetch).mockImplementation(async () => Response.json({ events: [score] }));
  const first = await request("/api/sports/livescores/123");
  expect(first.headers.get("Cache-Control")).toBe("no-store");
  expect(await first.json()).toEqual({ score });
  expect(
    await (await request("/api/sports/livescores/123", "GET", undefined, viewerCookie)).json(),
  ).toEqual({ score });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(scoreCache.put.mock.calls[0][1].headers.get("Cache-Control")).toBe("public, max-age=30");
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 30_001);
  await request("/api/sports/livescores/123");
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("failed live score requests are not cached and Cache API failures do not hide good scores", async () => {
  expect((await request("/api/sports/livescores/123")).status).toBe(502);
  expect(scoreCache.put).not.toHaveBeenCalled();
  scoreCache.match.mockRejectedValue(new Error("Cache unavailable"));
  scoreCache.put.mockRejectedValue(new Error("Cache unavailable"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(fetch).mockImplementation(async () => Response.json({ events: null }));
  expect(await (await request("/api/sports/livescores/123")).json()).toEqual({ score: null });
});

test.each(["/api/sports", "/api/sports/leagues/Soccer"])(
  "provider error objects never enter catalogue caches: %s",
  async (path) => {
    entries.clear();
    vi.mocked(fetch).mockImplementation(async () => Response.json({ error: "Unavailable" }));
    expect((await request(path)).status).toBe(502);
    expect(entries.size).toBe(0);
  },
);

test("malformed cached catalogue entries are repaired", async () => {
  entries.set("sportsdb:leagues:soccer:v1", { error: "Old invalid response" });
  const countries = [
    { idLeague: "1", strLeague: "League 1", strSport: "Soccer", strCountry: null, strBadge: null },
  ];
  vi.mocked(fetch).mockImplementation(async () => Response.json({ countries }));
  const response = await request("/api/sports/leagues/Soccer");
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Cache")).toBe("MISS");
  expect(entries.get("sportsdb:leagues:soccer:v1")).toEqual({ countries });
});
