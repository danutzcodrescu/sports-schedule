import * as appSchema from "./app-schema";
import * as authSchema from "./auth-schema";
import { drizzle } from "drizzle-orm/d1";

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema: { ...appSchema, ...authSchema } });
}

export type Db = ReturnType<typeof createDb>;
