import {
  LeagueRemovalConflict,
  previewLeagueRemoval,
  removeFollowedLeagues,
  SportsApiError,
} from "#/lib/api/sports";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import type { FavouriteTeam } from "#/lib/api/sports";

type RemovalRequest = {
  leagueIds: string[];
  additionalLeagueIds?: string[];
};

type Confirmation = { request: RemovalRequest; teams: FavouriteTeam[] };

export function useLeagueRemoval(onRemoved: () => Promise<void>) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const mutation = useMutation({
    mutationFn: async ({
      request,
      teams,
    }: {
      request: RemovalRequest;
      teams?: FavouriteTeam[];
    }): Promise<Confirmation | null> => {
      const affected =
        teams ??
        (request.leagueIds.length
          ? (await previewLeagueRemoval(request.leagueIds, request.additionalLeagueIds)).teams
          : []);
      if (!teams && affected.length) return { request, teams: affected };
      try {
        await removeFollowedLeagues(
          request.leagueIds,
          affected.map((team) => team.teamId),
          request.additionalLeagueIds ?? [],
        );
      } catch (error) {
        if (error instanceof LeagueRemovalConflict) return { request, teams: error.teams };
        throw error;
      }
      return null;
    },
    onSuccess: async (next) => {
      if (!next) await onRemoved();
      setConfirmation(next);
    },
  });

  return {
    confirmation,
    isPending: mutation.isPending,
    error: mutation.isError
      ? mutation.error instanceof SportsApiError &&
        mutation.error.code === "TEAM_MEMBERSHIP_CHECK_FAILED"
        ? "Could not save your leagues. Team memberships must be checked before removing anything. Please try again."
        : "Could not save your leagues. Please try again."
      : null,
    start: (request: RemovalRequest) => mutation.mutate({ request }),
    confirm: () => {
      if (confirmation) mutation.mutate(confirmation);
    },
    cancel: () => {
      if (mutation.isPending) return;
      setConfirmation(null);
      mutation.reset();
    },
  };
}
