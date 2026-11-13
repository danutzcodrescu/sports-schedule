import { getEventScore, getLeagueEvents, getLeagueTeams, refreshLeagueEvents } from "./sportsdb.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

import type { TestContext } from "node:test";

function mockRetryTimers(context: TestContext, random = 0.5) {
  const delays: number[] = [];
  context.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number) => {
    delays.push(delay);
    callback();
  });
  context.mock.method(Math, "random", () => random);
  return delays;
}

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

test("league event refresh retries a transient 503 before replacing cached data", async (context) => {
  const staleValue = JSON.stringify({ events: [{ idEvent: "old" }] });
  const freshEvents = { events: [{ idEvent: "new" }] };
  const entries = new Map([["sportsdb:events:4335:v1", staleValue]]);
  const cache = {
    put: async (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as KVNamespace;
  const delays: number[] = [];
  context.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number) => {
    delays.push(delay);
    assert.equal(entries.get("sportsdb:events:4335:v1"), staleValue);
    callback();
  });
  context.mock.method(Math, "random", () => 0.5);
  let requests = 0;
  const fetchMock = context.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return requests === 1 ? new Response(null, { status: 503 }) : Response.json(freshEvents);
  });

  assert.deepEqual(await refreshLeagueEvents(cache, "test-key", "4335"), freshEvents);
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.deepEqual(delays, [750]);
  assert.equal(entries.get("sportsdb:events:4335:v1"), JSON.stringify(freshEvents));
});

test("league event refresh preserves cached data when the upstream request fails", async (context) => {
  const delays = mockRetryTimers(context);
  const staleValue = JSON.stringify({ events: [{ idEvent: "old" }] });
  const entries = new Map([["sportsdb:events:4335:v1", staleValue]]);
  const cache = {
    put: async (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 503 }),
  );

  await assert.rejects(
    refreshLeagueEvents(cache, "test-key", "4335"),
    /TheSportsDB request failed with status 503/,
  );
  assert.equal(entries.get("sportsdb:events:4335:v1"), staleValue);
  assert.equal(fetchMock.mock.callCount(), 4);
  assert.deepEqual(delays, [750, 1_500, 3_000]);
});

for (const status of [429, 502, 503, 504]) {
  test(`league event refresh can recover from ${status} on its final retry`, async (context) => {
    const delays = mockRetryTimers(context);
    const events = { events: [{ idEvent: "new" }] };
    const writes: string[] = [];
    const cache = {
      put: async (_key: string, value: string) => {
        writes.push(value);
      },
    } as unknown as KVNamespace;
    let requests = 0;
    const fetchMock = context.mock.method(globalThis, "fetch", async () => {
      requests += 1;
      return requests <= 3 ? new Response(null, { status }) : Response.json(events);
    });

    assert.deepEqual(await refreshLeagueEvents(cache, "test-key", "4335"), events);
    assert.equal(fetchMock.mock.callCount(), 4);
    assert.deepEqual(delays, [750, 1_500, 3_000]);
    assert.deepEqual(writes, [JSON.stringify(events)]);
  });
}

for (const status of [400, 401, 403, 404]) {
  test(`league event refresh does not retry HTTP ${status}`, async (context) => {
    const delays = mockRetryTimers(context);
    const cache = {
      put: async () => assert.fail("Failed responses must not be cached"),
    } as unknown as KVNamespace;
    const fetchMock = context.mock.method(
      globalThis,
      "fetch",
      async () => new Response(null, { status }),
    );

    await assert.rejects(
      refreshLeagueEvents(cache, "test-key", "4335"),
      new RegExp(`status ${status}`),
    );
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.deepEqual(delays, []);
  });
}

for (const { header, expectedDelay } of [
  { header: "2", expectedDelay: 2_000 },
  { header: "Fri, 13 Nov 2026 00:00:03 GMT", expectedDelay: 3_000 },
  { header: "invalid", expectedDelay: 750 },
  { header: "0", expectedDelay: 750 },
  { header: "Thu, 12 Nov 2026 23:59:59 GMT", expectedDelay: 750 },
]) {
  test(`league event refresh respects Retry-After: ${header}`, async (context) => {
    const delays = mockRetryTimers(context);
    context.mock.method(Date, "now", () => Date.parse("2026-11-13T00:00:00Z"));
    const cache = { put: async () => {} } as unknown as KVNamespace;
    let requests = 0;
    context.mock.method(globalThis, "fetch", async () => {
      requests += 1;
      return requests === 1
        ? new Response(null, { status: 429, headers: { "Retry-After": header } })
        : Response.json({ events: [] });
    });

    await refreshLeagueEvents(cache, "test-key", "4335");
    assert.deepEqual(delays, [expectedDelay]);
    assert.equal(requests, 2);
  });
}

test("league event refresh stops when Retry-After exceeds the bounded wait", async (context) => {
  const delays = mockRetryTimers(context);
  const cache = {
    put: async () => assert.fail("Failed responses must not be cached"),
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 503, headers: { "Retry-After": "60" } }),
  );

  await assert.rejects(refreshLeagueEvents(cache, "test-key", "4335"), /status 503/);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(delays, []);
});

test("league event refresh releases a failed response body before retrying", async (context) => {
  mockRetryTimers(context);
  const cache = { put: async () => {} } as unknown as KVNamespace;
  let cancelled = false;
  let requests = 0;
  context.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    if (requests === 1) {
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { status: 503 },
      );
    }
    assert.equal(cancelled, true);
    return Response.json({ events: [] });
  });

  await refreshLeagueEvents(cache, "test-key", "4335");
  assert.equal(requests, 2);
});

test("league event refresh does not retry KV write failures", async (context) => {
  const delays = mockRetryTimers(context);
  const cache = {
    put: async () => {
      throw new Error("KV unavailable");
    },
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ events: [] }),
  );

  await assert.rejects(refreshLeagueEvents(cache, "test-key", "4335"), /KV unavailable/);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(delays, []);
});

test("event reads reuse cached data and share refresh retrieval and expiration on a miss", async (context) => {
  const events = { events: [{ idEvent: "new" }] };
  const entries = new Map<string, string>();
  const writes: Array<{ key: string; expirationTtl?: number }> = [];
  const cache = {
    get: async (key: string) => (entries.has(key) ? JSON.parse(entries.get(key)!) : null),
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      entries.set(key, value);
      writes.push({ key, expirationTtl: options?.expirationTtl });
    },
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(globalThis, "fetch", async (input: URL) => {
    assert.equal(input.pathname, "/api/v1/json/test-key/eventsnextleague.php");
    assert.equal(input.search, "?id=4335");
    return Response.json(events);
  });

  assert.deepEqual(await getLeagueEvents(cache, "test-key", "4335"), {
    data: events,
    status: "MISS",
  });
  assert.deepEqual(await getLeagueEvents(cache, "test-key", "4335"), {
    data: events,
    status: "HIT",
  });
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(writes, [{ key: "sportsdb:events:4335:v1", expirationTtl: 60 * 60 * 24 * 3 }]);

  const refreshed = { events: [{ idEvent: "refreshed" }] };
  fetchMock.mock.mockImplementation(async () => Response.json(refreshed));
  await refreshLeagueEvents(cache, "test-key", "4335");
  assert.deepEqual(await getLeagueEvents(cache, "test-key", "4335"), {
    data: refreshed,
    status: "HIT",
  });
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("event cache misses do not write failed or malformed upstream responses", async (context) => {
  const delays = mockRetryTimers(context);
  const writes: string[] = [];
  const cache = {
    get: async () => null,
    put: async (key: string) => {
      writes.push(key);
    },
  } as unknown as KVNamespace;
  const fetchMock = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 503 }),
  );

  await assert.rejects(getLeagueEvents(cache, "test-key", "4335"), /status 503/);
  assert.equal(fetchMock.mock.callCount(), 4);
  assert.deepEqual(delays, [750, 1_500, 3_000]);
  fetchMock.mock.mockImplementation(async () => new Response("invalid JSON"));
  await assert.rejects(getLeagueEvents(cache, "test-key", "4335"), SyntaxError);
  assert.equal(fetchMock.mock.callCount(), 5);
  assert.deepEqual(writes, []);
});

test("event scores look up only the requested ID without caching or returning event metadata", async (context) => {
  const score = { idEvent: "123", intHomeScore: "1", intAwayScore: "0", strStatus: "2H" };
  const fetchMock = context.mock.method(
    globalThis,
    "fetch",
    async (input: URL, init?: RequestInit) => {
      assert.equal(input.pathname, "/api/v1/json/test-key/lookupevent.php");
      assert.equal(input.search, "?id=123");
      assert.equal(init?.cache, "no-store");
      return Response.json({ events: [{ ...score, strEvent: "Home vs Away" }] });
    },
  );

  assert.deepEqual(await getEventScore("test-key", "123"), score);
  assert.deepEqual(await getEventScore("test-key", "123"), score);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("event score lookup returns null for missing events and rejects upstream failures", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ events: null }),
  );
  assert.equal(await getEventScore("test-key", "123"), null);
  fetchMock.mock.mockImplementation(async () =>
    Response.json({ events: [{ idEvent: "456", intHomeScore: "9" }] }),
  );
  assert.equal(await getEventScore("test-key", "123"), null);
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(getEventScore("test-key", "123"), /status 503/);
});
