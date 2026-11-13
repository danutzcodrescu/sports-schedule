// @vitest-environment node
import { followedLeaguesRoutes } from "./followed-leagues";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { AppEnv } from "../auth/middleware";
import type { Context, Next } from "hono";
import type { SQLInputValue } from "node:sqlite";

vi.mock("../auth/middleware", () => ({
  requireAuth: async (c: Context<AppEnv>, next: Next) => {
    c.set("user", {
      id: "fan",
      name: "Fan",
      email: "fan@example.test",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
    });
    await next();
  },
}));

let sqlite: DatabaseSync;
let env: CloudflareBindings;
let catalogues: Map<string, string[]>;
let rawCatalogues: Map<string, unknown>;

function teamDetails(idTeam: string, idLeague = "1") {
  return {
    idTeam,
    idLeague,
    strTeam: `Team ${idTeam}`,
    strLeague: `League ${idLeague}`,
    strSport: "Soccer",
    strCountry: null,
    strBadge: null,
  };
}

// Exercise real Drizzle SQL and transactional batches with an in-memory SQLite database.
function prepare(sql: string, values: SQLInputValue[] = []) {
  const statement = sqlite.prepare(sql);
  return {
    bind: (...params: SQLInputValue[]) => prepare(sql, params),
    raw: async () => statement.all(...values).map(Object.values),
    execute: () => ({ results: statement.all(...values), success: true, meta: {} }),
  };
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE league (id TEXT PRIMARY KEY, name TEXT, sport_name TEXT, country TEXT, badge_url TEXT, synced_at INTEGER);
    CREATE TABLE followed_league (user_id TEXT, league_id TEXT, created_at INTEGER DEFAULT 0, PRIMARY KEY (user_id, league_id));
    CREATE TABLE favourite_team (user_id TEXT, team_id TEXT, league_id TEXT, team_name TEXT, country TEXT, badge_url TEXT, created_at INTEGER DEFAULT 0, PRIMARY KEY (user_id, team_id));
  `);
  catalogues = new Map([
    ["1", ["10"]],
    ["2", []],
  ]);
  rawCatalogues = new Map();
  env = {
    DB: {
      prepare,
      batch: async (statements: ReturnType<typeof prepare>[]) => {
        sqlite.exec("BEGIN");
        try {
          const results = statements.map((statement) => statement.execute());
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
    SPORTS_CACHE: {
      get: async (key: string) => {
        const [, kind, leagueId] = key.split(":");
        if (kind === "league")
          return {
            id: leagueId,
            name: `League ${leagueId}`,
            sportName: "Soccer",
            country: null,
            badgeUrl: null,
            syncedAt: 0,
          };
        if (rawCatalogues.has(leagueId)) return rawCatalogues.get(leagueId);
        const ids = catalogues.get(leagueId);
        return ids ? { teams: ids.map((idTeam) => teamDetails(idTeam, leagueId)) } : null;
      },
      put: async () => {},
    },
    SPORTSDB_API_KEY: "test",
    GENERAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
    MUTATION_RATE_LIMITER: { limit: async () => ({ success: true }) },
  } as unknown as CloudflareBindings;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Provider unavailable")));
});

afterEach(() => sqlite.close());

function follow(leagueId: string, userId = "fan") {
  sqlite
    .prepare("INSERT INTO followed_league (user_id, league_id) VALUES (?, ?)")
    .run(userId, leagueId);
}

function favourite(teamId: string, leagueId: string, userId = "fan") {
  sqlite
    .prepare(
      "INSERT INTO favourite_team (user_id, team_id, league_id, team_name) VALUES (?, ?, ?, ?)",
    )
    .run(userId, teamId, leagueId, `Team ${teamId}`);
}

function request(path: string, method: string, body?: unknown) {
  return followedLeaguesRoutes.request(
    `https://example.test${path}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}

function savedTeams() {
  return sqlite
    .prepare("SELECT user_id, team_id, league_id FROM favourite_team ORDER BY user_id, team_id")
    .all()
    .map((row) => ({ ...row }));
}

test("previews without mutation, requires confirmation, and only removes this user's favourites", async () => {
  follow("1");
  follow("1", "other");
  favourite("10", "1");
  favourite("10", "1", "other");
  const preview = await request("/removal-preview", "POST", { leagueIds: ["1"] });
  expect(preview.status).toBe(200);
  expect(preview.headers.get("Cache-Control")).toBe("no-store");
  expect(await preview.json()).toMatchObject({ teams: [{ teamId: "10", teamName: "Team 10" }] });
  expect(savedTeams()).toHaveLength(2);
  expect((await request("/1", "DELETE")).status).toBe(409);
  expect(savedTeams()).toHaveLength(2);
  expect((await request("/1", "DELETE", { confirmedTeamIds: ["10"] })).status).toBe(204);
  expect(savedTeams()).toEqual([{ user_id: "other", team_id: "10", league_id: "1" }]);
  expect(sqlite.prepare("SELECT user_id FROM followed_league").all()).toMatchObject([
    { user_id: "other" },
  ]);
});

test("shared teams survive and are reassigned, then cascade when their last league is removed", async () => {
  follow("1");
  follow("2");
  favourite("10", "1");
  catalogues.set("2", ["10"]);
  expect(await (await request("/removal-preview", "POST", { leagueIds: ["1"] })).json()).toEqual({
    teams: [],
  });
  expect((await request("/", "DELETE", { leagueIds: ["1"] })).status).toBe(204);
  expect(savedTeams()).toEqual([{ user_id: "fan", team_id: "10", league_id: "2" }]);
  expect((await request("/2", "DELETE")).status).toBe(409);
  expect((await request("/2", "DELETE", { confirmedTeamIds: ["10"] })).status).toBe(204);
  expect(savedTeams()).toEqual([]);
});

test("bulk removals cannot protect each other, and unrelated favourites remain saved", async () => {
  follow("1");
  follow("2");
  favourite("10", "2");
  favourite("99", "3");
  catalogues.set("2", ["10"]);
  const preview = await request("/removal-preview", "POST", { leagueIds: ["1", "2"] });
  expect(await preview.json()).toMatchObject({ teams: [{ teamId: "10" }] });
  expect(
    (await request("/", "DELETE", { leagueIds: ["1", "2"], confirmedTeamIds: ["10"] })).status,
  ).toBe(204);
  expect(savedTeams()).toEqual([{ user_id: "fan", team_id: "99", league_id: "3" }]);
});

test("a saved remaining league protects membership even if its catalogue omits the team", async () => {
  follow("1");
  follow("2");
  favourite("10", "2");
  expect((await request("/1", "DELETE")).status).toBe(204);
  expect(savedTeams()).toEqual([{ user_id: "fan", team_id: "10", league_id: "2" }]);
});

test("provider failures leave both leagues and teams unchanged", async () => {
  follow("1");
  follow("2");
  favourite("10", "1");
  catalogues.delete("2");
  const preview = await request("/removal-preview", "POST", { leagueIds: ["1"] });
  expect(preview.status).toBe(502);
  expect(await preview.json()).toMatchObject({ code: "TEAM_MEMBERSHIP_CHECK_FAILED" });
  const commit = await request("/1", "DELETE", { confirmedTeamIds: ["10"] });
  expect(commit.status).toBe(502);
  expect(await commit.json()).toMatchObject({ code: "TEAM_MEMBERSHIP_CHECK_FAILED" });
  expect(savedTeams()).toHaveLength(1);
  expect(sqlite.prepare("SELECT * FROM followed_league").all()).toHaveLength(2);
});

test("database failures are not labelled as membership-check failures", async () => {
  vi.spyOn(env.DB, "prepare").mockImplementation(() => {
    throw new Error("Database unavailable");
  });
  const response = await request("/removal-preview", "POST", { leagueIds: ["1"] });
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("TEAM_MEMBERSHIP_CHECK_FAILED");
});

test("a stale preview cannot silently remove an additional favourite", async () => {
  follow("1");
  follow("2");
  favourite("10", "1");
  catalogues.set("2", ["10"]);
  expect(await (await request("/removal-preview", "POST", { leagueIds: ["1"] })).json()).toEqual({
    teams: [],
  });
  catalogues.set("2", []);
  const commit = await request("/", "DELETE", { leagueIds: ["1"], confirmedTeamIds: [] });
  expect(commit.status).toBe(409);
  expect(await commit.json()).toMatchObject({ teams: [{ teamId: "10" }] });
  expect(savedTeams()).toHaveLength(1);
});

test("secondary league membership protects a favourite when the cup catalogue is unavailable", async () => {
  follow("1");
  follow("2");
  favourite("10", "1");
  rawCatalogues.set("1", { teams: [{ ...teamDetails("10"), idLeague4: "2" }] });
  rawCatalogues.set("2", { teams: null });
  const preview = await request("/removal-preview", "POST", { leagueIds: ["1"] });
  expect(preview.status).toBe(200);
  expect(await preview.json()).toEqual({ teams: [] });
  expect((await request("/1", "DELETE")).status).toBe(204);
  expect(savedTeams()).toEqual([{ user_id: "fan", team_id: "10", league_id: "2" }]);
});

test("secondary membership in an unfollowed league does not protect a favourite", async () => {
  follow("1");
  favourite("10", "1");
  rawCatalogues.set("1", { teams: [{ ...teamDetails("10"), idLeague4: "2" }] });
  expect((await request("/1", "DELETE", { confirmedTeamIds: ["10"] })).status).toBe(204);
  expect(savedTeams()).toEqual([]);
});

test.each(["cached", "upstream"])("malformed %s team catalogues block deletion", async (source) => {
  follow("1");
  follow("2");
  favourite("10", "1");
  if (source === "cached") rawCatalogues.set("2", { error: "Team catalogue unavailable" });
  else {
    catalogues.delete("2");
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({ error: "Team catalogue unavailable" }),
    );
  }
  expect((await request("/removal-preview", "POST", { leagueIds: ["1"] })).status).toBe(502);
  expect((await request("/1", "DELETE", { confirmedTeamIds: ["10"] })).status).toBe(502);
  expect(savedTeams()).toHaveLength(1);
  expect(sqlite.prepare("SELECT * FROM followed_league").all()).toHaveLength(2);
});

test("a null remaining catalogue cannot be used as evidence of non-membership", async () => {
  follow("1");
  follow("2");
  favourite("10", "1");
  rawCatalogues.set("2", { teams: null });
  expect((await request("/1", "DELETE", { confirmedTeamIds: ["10"] })).status).toBe(502);
  expect(savedTeams()).toHaveLength(1);
});

test("mixed league changes preserve shared teams and commit additions with removals", async () => {
  follow("1");
  favourite("10", "1");
  catalogues.set("2", ["10"]);
  expect(
    (await request("/", "DELETE", { leagueIds: ["1"], additionalLeagueIds: ["2"] })).status,
  ).toBe(204);
  expect(savedTeams()).toEqual([{ user_id: "fan", team_id: "10", league_id: "2" }]);
  expect(
    sqlite.prepare("SELECT league_id FROM followed_league WHERE user_id = 'fan'").all(),
  ).toMatchObject([{ league_id: "2" }]);
});

test("conflicting mixed changes persist no additions before confirmation", async () => {
  follow("1");
  favourite("10", "1");
  const commit = await request("/", "DELETE", { leagueIds: ["1"], additionalLeagueIds: ["2"] });
  expect(commit.status).toBe(409);
  expect(sqlite.prepare("SELECT league_id FROM followed_league").all()).toMatchObject([
    { league_id: "1" },
  ]);
  expect(sqlite.prepare("SELECT * FROM league").all()).toHaveLength(0);
});

test("addition-only changes use the same atomic preference update", async () => {
  const commit = await request("/", "DELETE", { leagueIds: [], additionalLeagueIds: ["2"] });
  expect(commit.status).toBe(204);
  expect(sqlite.prepare("SELECT league_id FROM followed_league").all()).toMatchObject([
    { league_id: "2" },
  ]);
  expect(sqlite.prepare("SELECT id, name FROM league").all()).toMatchObject([
    { id: "2", name: "League 2" },
  ]);
});

test("picker previews account for newly selected leagues without mutating preferences", async () => {
  follow("1");
  favourite("10", "1");
  catalogues.set("2", ["10"]);
  const preview = await request("/removal-preview", "POST", {
    leagueIds: ["1"],
    additionalLeagueIds: ["2"],
  });
  expect(await preview.json()).toEqual({ teams: [] });
  expect(sqlite.prepare("SELECT * FROM followed_league").all()).toHaveLength(1);
  follow("2");
  expect((await request("/", "DELETE", { leagueIds: ["1"] })).status).toBe(204);
  expect(savedTeams()[0].league_id).toBe("2");
});

test.each([{ additionalLeagueIds: [] }, { additionalLeagueIds: ["2"] }])(
  "league additions, removals, and favourite changes roll back together ($additionalLeagueIds)",
  async ({ additionalLeagueIds }) => {
    follow("1");
    favourite("10", "1");
    sqlite.exec(
      "CREATE TRIGGER prevent_team_removal BEFORE DELETE ON favourite_team BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    expect(
      (
        await request("/", "DELETE", {
          leagueIds: ["1"],
          confirmedTeamIds: ["10"],
          additionalLeagueIds,
        })
      ).status,
    ).toBe(500);
    expect(savedTeams()).toHaveLength(1);
    expect(sqlite.prepare("SELECT * FROM followed_league").all()).toHaveLength(1);
    expect(sqlite.prepare("SELECT * FROM league").all()).toHaveLength(0);
  },
);

test.each([
  ["/removal-preview", "POST", { leagueIds: ["bad"] }],
  ["/removal-preview", "POST", { leagueIds: ["1"], additionalLeagueIds: [null] }],
  ["/", "DELETE", { leagueIds: ["1"], confirmedTeamIds: [10] }],
  ["/", "DELETE", { leagueIds: ["1"], additionalLeagueIds: [null] }],
  ["/", "DELETE", { leagueIds: ["1"], additionalLeagueIds: ["1"] }],
  ["/bad", "DELETE", {}],
])("invalid removal input is rejected (%s %s)", async (path, method, body) => {
  expect((await request(path, method, body)).status).toBe(400);
});
