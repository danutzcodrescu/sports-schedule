import { preferenceRevision } from "../db/app-schema";
import { eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import type { BatchItem } from "drizzle-orm/batch";

export async function getPreferenceVersion(db: Db, userId: string) {
  const revision = await db
    .select({ version: preferenceRevision.version })
    .from(preferenceRevision)
    .where(eq(preferenceRevision.userId, userId))
    .get();
  return revision?.version ?? 0;
}

export async function commitPreferences(
  db: Db,
  userId: string,
  version: number,
  statements: BatchItem<"sqlite">[],
) {
  try {
    await db.batch([
      db
        .insert(preferenceRevision)
        .values({ userId, version: version + 1 })
        .onConflictDoUpdate({
          target: preferenceRevision.userId,
          // NULL deliberately fails the constraint and rolls back the entire stale batch.
          set: {
            version: sql`case when ${preferenceRevision.version} = ${version} then ${version + 1} else null end`,
          },
        }),
      ...statements,
    ]);
    return true;
  } catch (error) {
    for (let cause = error; cause instanceof Error; cause = cause.cause) {
      if (cause.message.includes("NOT NULL constraint failed: preference_revision.version")) {
        return false;
      }
    }
    throw error;
  }
}
