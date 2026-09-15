import { user } from "./auth-schema";
import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const league = sqliteTable("league", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sportName: text("sport_name").notNull(),
  country: text("country"),
  badgeUrl: text("badge_url"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

export const followedLeague = sqliteTable(
  "followed_league",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    leagueId: text("league_id")
      .notNull()
      .references(() => league.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.leagueId] }),
    index("followed_league_user_id_idx").on(table.userId),
  ],
);

export const leagueRelations = relations(league, ({ many }) => ({
  followers: many(followedLeague),
}));

export const userFollowedLeagueRelations = relations(user, ({ many }) => ({
  followedLeagues: many(followedLeague),
}));

export const followedLeagueRelations = relations(followedLeague, ({ one }) => ({
  league: one(league, {
    fields: [followedLeague.leagueId],
    references: [league.id],
  }),
  user: one(user, {
    fields: [followedLeague.userId],
    references: [user.id],
  }),
}));
