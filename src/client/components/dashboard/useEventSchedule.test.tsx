import * as sports from "#/lib/api/sports";
import { EventCard } from "./EventCard";
import { SportsDashboard } from "./SportsDashboard";
import { makeEvent, makeFavouriteTeam, makeLeague } from "./test-fixtures";
import { useEventSchedule } from "./useEventSchedule";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { ReactNode } from "react";

const now = new Date(2026, 8, 16, 12);
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  focusManager.setFocused(true);
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

function openSchedule(overrides: Partial<Parameters<typeof useEventSchedule>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const context = {
    leagues: [makeLeague("1"), makeLeague("2"), makeLeague("3")],
    favouriteTeams: [makeFavouriteTeam("10", "1")],
    events: [makeEvent("favourite"), makeEvent("other", { idHomeTeam: "30", idAwayTeam: "40" })],
    isLoading: false,
    hasError: false,
    ...overrides,
  };
  return renderHook((props) => useEventSchedule(props), {
    initialProps: context,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

test("team toggles restore the previous Favourites/All choice and explicit team filters clear selection", () => {
  const { result } = openSchedule();
  expect(result.current.visibleEvents.map((event) => event.idEvent)).toEqual(["favourite"]);
  act(() => result.current.changeSelection({ type: "teams", filter: "all" }));
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  expect(result.current.visibleEvents.map((event) => event.idEvent)).toEqual(["favourite"]);
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  expect(result.current.selectedTeam).toBeNull();
  expect(result.current.teamFilter).toBe("all");
  expect(result.current.visibleEvents).toHaveLength(2);

  act(() => result.current.changeSelection({ type: "teams", filter: "favourites" }));
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  act(() => result.current.changeSelection({ type: "clear-team" }));
  expect(result.current.teamFilter).toBe("favourites");
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  act(() => result.current.changeSelection({ type: "teams", filter: "all" }));
  expect(result.current.selectedTeam).toBeNull();
  expect(result.current.visibleEvents).toHaveLength(2);
});

test("league and period choices remain independent of an individual team selection", () => {
  const tomorrow = new Date(2026, 8, 17, 13).toISOString();
  const { result } = openSchedule({
    events: [
      makeEvent("today"),
      makeEvent("cross-league", { idLeague: "2", strTimestamp: tomorrow }),
      makeEvent("other", {
        idLeague: "2",
        idHomeTeam: "30",
        idAwayTeam: "40",
        strTimestamp: tomorrow,
      }),
    ],
  });
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  act(() => result.current.changeSelection({ type: "league", leagueId: "2" }));
  act(() => result.current.changeSelection({ type: "period", filter: "tomorrow" }));
  expect(result.current.selectedTeam?.teamId).toBe("10");
  expect(result.current.visibleEvents.map((event) => event.idEvent)).toEqual(["cross-league"]);
  act(() => result.current.changeSelection({ type: "period", filter: "today" }));
  expect(result.current.visibleEvents).toHaveLength(0);
  expect(result.current.selectedTeam?.teamId).toBe("10");
  expect(result.current.teamFilter).toBe("favourites");
});

test("choosing a league without favourite teams clears the individual team and falls back to All", () => {
  const { result } = openSchedule();
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  act(() => result.current.changeSelection({ type: "league", leagueId: "3" }));
  expect(result.current.selectedLeagueId).toBe("3");
  expect(result.current.selectedTeam).toBeNull();
  expect(result.current.teamFilter).toBe("all");
});

test.each(["today", "tomorrow", "live"] as const)(
  "%s falls back to All when favourites have no matching events",
  (filter) => {
    const { result } = openSchedule({
      events: [makeEvent("other", { idHomeTeam: "30", idAwayTeam: "40" })],
    });
    act(() => result.current.changeSelection({ type: "period", filter }));
    expect(result.current.teamFilter).toBe("all");
    expect(result.current.activeFilter).toBe(filter);
  },
);

test("Upcoming deliberately keeps Favourites even when only other teams have events", () => {
  const { result } = openSchedule({
    events: [makeEvent("other", { idHomeTeam: "30", idAwayTeam: "40" })],
  });
  act(() => result.current.changeSelection({ type: "period", filter: "upcoming" }));
  expect(result.current.teamFilter).toBe("favourites");
  expect(result.current.visibleEvents).toHaveLength(0);
});

test.each([{ isLoading: true }, { hasError: true }])(
  "unavailable data does not change the team filter: %j",
  (status) => {
    const { result } = openSchedule({ events: [], ...status });
    act(() => result.current.changeSelection({ type: "period", filter: "today" }));
    expect(result.current.teamFilter).toBe("favourites");
  },
);

test("removing selected saved choices restores all followed events, including non-team events", () => {
  const events = [makeEvent("race", { idLeague: "2", idHomeTeam: null, idAwayTeam: null })];
  const { result, rerender } = openSchedule({ events });
  act(() => result.current.changeSelection({ type: "league", leagueId: "1" }));
  act(() => result.current.changeSelection({ type: "team", teamId: "10" }));
  rerender({
    leagues: [makeLeague("2")],
    favouriteTeams: [],
    events,
    isLoading: false,
    hasError: false,
  });
  expect(result.current.selectedLeagueId).toBeNull();
  expect(result.current.selectedTeam).toBeNull();
  expect(result.current.isFilteringTeams).toBe(false);
  expect(result.current.visibleEvents).toEqual(events);
});

test("live scores poll only visible live events, pause on blur, and resume with a fresh clock", async () => {
  const live = makeEvent("live", { strTimestamp: new Date(2026, 8, 16, 11, 30).toISOString() });
  const getScore = vi.spyOn(sports, "getEventScore").mockResolvedValue({
    idEvent: "live",
    intHomeScore: null,
    intAwayScore: "2",
    strStatus: "2H",
  });
  const { result, unmount } = openSchedule({ events: [live, makeEvent("future")] });
  expect(getScore).not.toHaveBeenCalled();
  act(() => result.current.changeSelection({ type: "period", filter: "live" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(getScore).toHaveBeenCalledWith("live", expect.any(AbortSignal));
  expect(result.current.liveCount).toBe(1);
  expect(result.current.liveScoresByEvent.get("live")).toEqual({
    home: "0",
    away: "2",
    status: "2H",
  });

  getScore.mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(getScore).toHaveBeenCalledTimes(1);
  act(() => focusManager.setFocused(false));
  const pausedAt = result.current.now.getTime();
  getScore.mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });
  expect(getScore).not.toHaveBeenCalled();
  expect(result.current.now.getTime()).toBe(pausedAt);

  act(() => focusManager.setFocused(true));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(getScore).toHaveBeenCalled();
  expect(result.current.now.getTime()).toBeGreaterThan(pausedAt);

  unmount();
  getScore.mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });
  expect(getScore).not.toHaveBeenCalled();
});

test("the focused clock starts score requests at kickoff and stops them after the estimated window", async () => {
  const event = makeEvent("kickoff", { strTimestamp: new Date(2026, 8, 16, 12, 1).toISOString() });
  const getScore = vi.spyOn(sports, "getEventScore").mockResolvedValue(null);
  const { result } = openSchedule({ events: [event] });
  act(() => result.current.changeSelection({ type: "period", filter: "today" }));
  expect(getScore).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_010);
  });
  expect(getScore).toHaveBeenCalledWith("kickoff", expect.any(AbortSignal));
  expect(result.current.liveScoresByEvent.size).toBe(0);

  vi.setSystemTime(new Date(2026, 8, 16, 15));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  getScore.mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(getScore).not.toHaveBeenCalled();
  expect(result.current.liveCount).toBe(0);
});

test("event cards suppress scores outside the playing window and keep absent live scores absent", () => {
  const event = makeEvent("future");
  const { rerender } = render(
    <EventCard event={event} now={now} liveScore={{ home: "8", away: "9", status: "2H" }} />,
  );
  expect(screen.queryByText("8")).toBeNull();
  expect(screen.queryByText("9")).toBeNull();
  rerender(<EventCard event={event} now={new Date(2026, 8, 16, 13, 30)} />);
  expect(screen.queryByText("0")).toBeNull();
});

test("dashboard controls share selection rules and long team/league labels retain wrapping", () => {
  const league = {
    ...makeLeague("1"),
    leagueName: "A very long followed league name that must wrap",
  };
  const team = {
    ...makeFavouriteTeam("10", "1"),
    teamName: "A very long favourite team name that must wrap",
  };
  const client = new QueryClient();
  clients.push(client);
  client.setQueryData(["league-events", "1"], [makeEvent("favourite")]);
  client.setQueryData(
    ["league-events", "2"],
    [makeEvent("other", { idLeague: "2", idHomeTeam: "30", idAwayTeam: "40" })],
  );
  render(
    <QueryClientProvider client={client}>
      <SportsDashboard
        userName="Fan"
        leagues={[league, makeLeague("2")]}
        favouriteTeams={[team]}
        onTeamsChanged={async () => {}}
        onLeaguesChanged={async () => {}}
        onSignOut={async () => {}}
      />
    </QueryClientProvider>,
  );
  const sidebar = within(screen.getByRole("complementary"));
  const teamButton = sidebar.getByRole("button", { name: team.teamName });
  const all = screen.getByRole("button", { name: "All" });
  fireEvent.click(all);
  expect(screen.getByRole("status").textContent).toContain("2 scheduled events");
  fireEvent.click(teamButton);
  expect(screen.getByRole("status").textContent).toContain("1 scheduled event");
  fireEvent.click(teamButton);
  expect(all.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("status").textContent).toContain("2 scheduled events");

  fireEvent.click(sidebar.getByRole("button", { name: league.leagueName }));
  const picker = screen.getByRole("button", { name: "Followed leagues" });
  expect(picker.classList.contains("whitespace-normal")).toBe(true);
  expect(picker.classList.contains("h-auto")).toBe(true);
  expect(within(picker).getByText(league.leagueName).classList.contains("wrap-anywhere")).toBe(
    true,
  );
  expect(within(teamButton).getByText(team.teamName).classList.contains("wrap-anywhere")).toBe(
    true,
  );
  expect(sidebar.getByText(league.leagueName).classList.contains("wrap-anywhere")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Favourites" }));
  fireEvent.click(teamButton);
  fireEvent.click(sidebar.getByRole("button", { name: "League 2" }));
  expect(teamButton.getAttribute("aria-pressed")).toBe("false");
  expect(all.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("status").textContent).toContain("1 scheduled event");
});
