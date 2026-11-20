import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type { SQLInputValue } from "node:sqlite";

export function createTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const journal = JSON.parse(
    readFileSync(new URL("../../migrations/meta/_journal.json", import.meta.url), "utf8"),
  ) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries) {
    sqlite.exec(readFileSync(new URL(`../../migrations/${tag}.sql`, import.meta.url), "utf8"));
  }

  function prepare(sql: string, values: SQLInputValue[] = []) {
    const statement = sqlite.prepare(sql);
    return {
      bind: (...params: SQLInputValue[]) => prepare(sql, params),
      raw: async () => statement.all(...values).map(Object.values),
      first: async () => statement.get(...values) ?? null,
      all: async () => ({ results: statement.all(...values), success: true, meta: {} }),
      run: async () => ({ success: true, meta: statement.run(...values) }),
      execute: () => ({ results: statement.all(...values), success: true, meta: {} }),
    };
  }

  const d1 = {
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
  } as unknown as D1Database;
  return { sqlite, d1 };
}
