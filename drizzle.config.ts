import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/worker/db/auth-schema.ts", "./src/worker/db/app-schema.ts"],
  out: "./migrations",
});
