import * as sports from "#/lib/api/sports";
import { AddLeagueDialog } from "./AddLeagueDialog";
import { DashboardHeader } from "./DashboardHeader";
import { LeagueRemovalConfirmation } from "./LeagueRemovalConfirmation";
import { LeagueSidebar } from "./LeagueSidebar";
import { makeFavouriteTeam, makeLeague } from "./test-fixtures";
import { useLeagueRemoval } from "./useLeagueRemoval";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

function RemovalHarness({
  onRemoved = async () => {},
  additionalLeagueIds,
}: {
  onRemoved?: () => Promise<void>;
  additionalLeagueIds?: string[];
}) {
  const removal = useLeagueRemoval(onRemoved);
  return (
    <>
      <button
        disabled={removal.isPending}
        onClick={() => removal.start({ leagueIds: ["1"], additionalLeagueIds })}
      >
        Remove League 1
      </button>
      {removal.error ? <p role="alert">{removal.error}</p> : null}
      <LeagueRemovalConfirmation removal={removal} />
    </>
  );
}

function openRemoval(props: Parameters<typeof RemovalHarness>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <RemovalHarness {...props} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove League 1" }));
}

test("cascading removal lists teams, supports cancellation, and waits for confirmation", async () => {
  vi.spyOn(sports, "previewLeagueRemoval").mockResolvedValue({
    teams: [makeFavouriteTeam("10", "1")],
  });
  const remove = vi.spyOn(sports, "removeFollowedLeagues").mockResolvedValue();
  openRemoval({ additionalLeagueIds: ["2"] });
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("Favourite")).toBeTruthy();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("confirmation removes only the reviewed team IDs and refreshes preferences", async () => {
  vi.spyOn(sports, "previewLeagueRemoval").mockResolvedValue({
    teams: [makeFavouriteTeam("10", "1")],
  });
  const remove = vi.spyOn(sports, "removeFollowedLeagues").mockResolvedValue();
  const onRemoved = vi.fn(async () => {});
  openRemoval({ onRemoved, additionalLeagueIds: ["2"] });
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Remove league and teams",
    }),
  );
  await waitFor(() => expect(remove).toHaveBeenCalledWith(["1"], ["10"], ["2"]));
  await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
});

test("no cascading teams means immediate removal without confirmation", async () => {
  vi.spyOn(sports, "previewLeagueRemoval").mockResolvedValue({ teams: [] });
  const remove = vi.spyOn(sports, "removeFollowedLeagues").mockResolvedValue();
  openRemoval();
  await waitFor(() => expect(remove).toHaveBeenCalledWith(["1"], [], []));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a failed membership check reports an error and never attempts deletion", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ code: "TEAM_MEMBERSHIP_CHECK_FAILED" }, { status: 502 }),
      ),
  );
  const remove = vi.spyOn(sports, "removeFollowedLeagues").mockResolvedValue();
  openRemoval();
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Team memberships must be checked",
  );
  expect(remove).not.toHaveBeenCalled();
});

test.each([
  { stage: "preview", status: 401 },
  { stage: "preview", status: 429 },
  { stage: "preview", status: 500 },
  { stage: "save", status: 403 },
  { stage: "save", status: 502 },
])(
  "unrelated $stage errors ($status) show only a generic save message",
  async ({ stage, status }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        if (stage === "save" && String(url).endsWith("/removal-preview"))
          return Response.json({ teams: [] });
        return Response.json({ error: "Some other failure" }, { status });
      }),
    );
    openRemoval();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not save your leagues. Please try again.",
    );
  },
);

test("network errors show a generic message rather than a membership warning", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  openRemoval();
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not save your leagues. Please try again.",
  );
});

test("non-JSON error responses fall back to the generic message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => new Response("Unavailable", { status: 503 })),
  );
  openRemoval();
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not save your leagues. Please try again.",
  );
});

test("a membership failure during commit retains the specific warning", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url) => {
      return String(url).endsWith("/removal-preview")
        ? Response.json({ teams: [] })
        : Response.json({ code: "TEAM_MEMBERSHIP_CHECK_FAILED" }, { status: 502 });
    }),
  );
  openRemoval();
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Team memberships must be checked",
  );
});

test("a stale preview prompts for the updated teams before retrying", async () => {
  vi.spyOn(sports, "previewLeagueRemoval").mockResolvedValue({ teams: [] });
  const remove = vi
    .spyOn(sports, "removeFollowedLeagues")
    .mockRejectedValueOnce(new sports.LeagueRemovalConflict([makeFavouriteTeam("20", "1")]))
    .mockResolvedValue();
  openRemoval();
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("Favourite")).toBeTruthy();
  expect(remove).toHaveBeenCalledTimes(1);
  fireEvent.click(dialog.getByRole("button", { name: "Remove league and teams" }));
  await waitFor(() => expect(remove).toHaveBeenLastCalledWith(["1"], ["20"], []));
});

function navigationProps() {
  return {
    leagues: [makeLeague("1")],
    activeLeagueId: null,
    onLeagueChange: vi.fn(),
    onAddLeague: vi.fn(),
    onRemoveLeague: vi.fn(),
    isRemovingLeague: false,
    leagueRemovalError: null,
    onSignOut: vi.fn(async () => {}),
    teams: [makeFavouriteTeam("10", "1")],
    activeTeamId: null,
    onTeamChange: vi.fn(),
    onAddTeam: vi.fn(),
    onRemoveTeam: vi.fn(),
    isSavingTeams: false,
    hasTeamsError: false,
  };
}

test("desktop remove buttons are separate from selecting league and team rows", () => {
  const props = navigationProps();
  render(<LeagueSidebar {...props} userName="Fan" />);
  fireEvent.click(screen.getByRole("button", { name: "Remove League 1 from followed leagues" }));
  expect(props.onRemoveLeague).toHaveBeenCalledWith("1");
  expect(props.onLeagueChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remove Favourite from favourites" }));
  expect(props.onRemoveTeam).toHaveBeenCalledWith("10");
  expect(props.onTeamChange).not.toHaveBeenCalled();
});

test("the mobile menu exposes a separate removal item without selecting the league", async () => {
  const props = navigationProps();
  render(<DashboardHeader {...props} onSearch={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Followed leagues" }));
  const remove = await screen.findByRole("menuitem", {
    name: "Remove League 1 from followed leagues",
  });
  expect(remove.classList.contains("opacity-100")).toBe(true);
  fireEvent.click(remove);
  expect(props.onRemoveLeague).toHaveBeenCalledWith("1");
  expect(props.onLeagueChange).not.toHaveBeenCalled();
});

function openLeaguePicker(followedIds: string[]) {
  const onSaved = vi.fn(async () => {});
  const client = new QueryClient();
  clients.push(client);
  client.setQueryData(
    ["sports"],
    [
      {
        idSport: "1",
        strSport: "Soccer",
        strFormat: "TeamvsTeam",
        strSportThumb: null,
        strSportDescription: null,
      },
    ],
  );
  client.setQueryData(
    ["leagues", "Soccer"],
    ["1", "2", "3"].map((idLeague) => ({
      idLeague,
      strLeague: `League ${idLeague}`,
      strSport: "Soccer",
      strCountry: null,
      strBadge: null,
    })),
  );
  render(
    <QueryClientProvider client={client}>
      <AddLeagueDialog
        followedLeagues={followedIds.map(makeLeague)}
        onOpenChange={vi.fn()}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Soccer" }));
  return { onSaved };
}

test("the league picker previews additions and removals together, and cancellation changes nothing", async () => {
  const preview = vi
    .spyOn(sports, "previewLeagueRemoval")
    .mockResolvedValue({ teams: [makeFavouriteTeam("10", "1")] });
  const remove = vi.spyOn(sports, "removeFollowedLeagues").mockResolvedValue();
  const follow = vi.spyOn(sports, "followLeague").mockResolvedValue({ league: makeLeague("3") });
  const { onSaved } = openLeaguePicker(["1", "2"]);
  fireEvent.click(screen.getByRole("button", { name: /League 1/ }));
  fireEvent.click(screen.getByRole("button", { name: /League 3/ }));
  fireEvent.click(screen.getByRole("button", { name: /Done/ }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Remove league and favourite teams?" }),
  );
  expect(preview).toHaveBeenCalledWith(["1"], ["3"]);
  expect(follow).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Remove league and favourite teams?" })).toBeNull(),
  );
  expect(follow).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /Done/ }));
  fireEvent.click(
    within(
      await screen.findByRole("dialog", { name: "Remove league and favourite teams?" }),
    ).getByRole("button", { name: "Remove league and teams" }),
  );
  await waitFor(() => expect(remove).toHaveBeenCalledWith(["1"], ["10"], ["3"]));
  expect(follow).not.toHaveBeenCalled();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
});

test("confirmation cannot be submitted twice while deletion is pending", async () => {
  vi.spyOn(sports, "previewLeagueRemoval").mockResolvedValue({
    teams: [makeFavouriteTeam("10", "1")],
  });
  let finish!: () => void;
  const remove = vi.spyOn(sports, "removeFollowedLeagues").mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  openRemoval();
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Remove league and teams" }));
  const pending = await dialog.findByRole("button", { name: "Removing…" });
  expect(pending.hasAttribute("disabled")).toBe(true);
  fireEvent.click(pending);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(dialog.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
  finish();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("cancelling a refreshed mixed-change confirmation never follows the new league", async () => {
  vi.spyOn(sports, "previewLeagueRemoval").mockResolvedValue({ teams: [] });
  vi.spyOn(sports, "removeFollowedLeagues").mockRejectedValueOnce(
    new sports.LeagueRemovalConflict([makeFavouriteTeam("10", "1")]),
  );
  const follow = vi.spyOn(sports, "followLeague").mockResolvedValue({ league: makeLeague("2") });
  const { onSaved } = openLeaguePicker(["1"]);
  fireEvent.click(screen.getByRole("button", { name: /League 1/ }));
  fireEvent.click(screen.getByRole("button", { name: /League 2/ }));
  fireEvent.click(screen.getByRole("button", { name: /Done/ }));
  fireEvent.click(
    within(
      await screen.findByRole("dialog", { name: "Remove league and favourite teams?" }),
    ).getByRole("button", { name: "Cancel" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Remove league and favourite teams?" })).toBeNull(),
  );
  expect(follow).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
});

test("addition-only saves use the same atomic change request without a removal preview", async () => {
  const preview = vi.spyOn(sports, "previewLeagueRemoval");
  const save = vi.spyOn(sports, "removeFollowedLeagues").mockResolvedValue();
  const follow = vi.spyOn(sports, "followLeague");
  const { onSaved } = openLeaguePicker(["1"]);
  fireEvent.click(screen.getByRole("button", { name: /League 2/ }));
  fireEvent.click(screen.getByRole("button", { name: /Done/ }));
  await waitFor(() => expect(save).toHaveBeenCalledWith([], [], ["2"]));
  expect(preview).not.toHaveBeenCalled();
  expect(follow).not.toHaveBeenCalled();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
});

test("an addition-only failure shows the generic save message", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ error: "Could not check league additions" }, { status: 502 }),
      ),
  );
  openLeaguePicker(["1"]);
  fireEvent.click(screen.getByRole("button", { name: /League 2/ }));
  fireEvent.click(screen.getByRole("button", { name: /Done/ }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not save your leagues. Please try again.",
  );
});
