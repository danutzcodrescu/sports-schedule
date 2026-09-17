import { getLeagueTeams, refreshLeagueEvents } from "./sportsdb.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("league team lookup uses the supported list API with the league ID and caches its result", async (context) => {
  const teams = [{ idTeam: "133738", strTeam: "Barcelona", idLeague: "4335" }];
  const entries = new Map<string, string>([
    ["sportsdb:teams:4335:v1", JSON.stringify({ teams: [{ idTeam: "obsolete" }] })],
  ]);
  const cache = {
    get: async (key: string) => (entries.has(key) ? JSON.parse(entries.get(key)!) : null),
    put: async (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(globalThis, "fetch", async (input: URL) => {
    assert.equal(input.origin, "https://www.thesportsdb.com");
    assert.equal(input.pathname, "/api/v1/json/test-key/search_all_teams.php");
    assert.equal(input.search, "?id=4335");
    return Response.json({ teams });
  });

  assert.deepEqual(await getLeagueTeams(cache, "test-key", "4335"), { teams, status: "MISS" });
  assert.deepEqual(await getLeagueTeams(cache, "test-key", "4335"), { teams, status: "HIT" });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("league event refresh bypasses stale cache data and replaces it", async (context) => {
  const staleEvents = { events: [{ idEvent: "old" }] };
  const freshEvents = { events: [{ idEvent: "new" }] };
  const entries = new Map([["sportsdb:events:4335:v1", JSON.stringify(staleEvents)]]);
  const writes: Array<{ key: string; value: string; expirationTtl?: number }> = [];
  const cache = {
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      entries.set(key, value);
      writes.push({ key, value, expirationTtl: options?.expirationTtl });
    },
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(globalThis, "fetch", async (input: URL) => {
    assert.equal(input.pathname, "/api/v1/json/test-key/eventsnextleague.php");
    assert.equal(input.search, "?id=4335");
    return Response.json(freshEvents);
  });

  assert.deepEqual(await refreshLeagueEvents(cache, "test-key", "4335"), freshEvents);
  assert.deepEqual(JSON.parse(entries.get("sportsdb:events:4335:v1")!), freshEvents);
  assert.deepEqual(writes, [
    {
      key: "sportsdb:events:4335:v1",
      value: JSON.stringify(freshEvents),
      expirationTtl: 60 * 60 * 24 * 3,
    },
  ]);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("league event refresh preserves cached data when the upstream request fails", async (context) => {
  const staleValue = JSON.stringify({ events: [{ idEvent: "old" }] });
  const entries = new Map([["sportsdb:events:4335:v1", staleValue]]);
  const cache = {
    put: async (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as KVNamespace;
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));

  await assert.rejects(
    refreshLeagueEvents(cache, "test-key", "4335"),
    /TheSportsDB request failed with status 503/,
  );
  assert.equal(entries.get("sportsdb:events:4335:v1"), staleValue);
});
