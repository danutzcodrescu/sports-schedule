import { getLeagueTeams } from "./sportsdb.ts";
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
