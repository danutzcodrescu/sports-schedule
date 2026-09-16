import { createDb } from "../db";
import * as authSchema from "../db/auth-schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha } from "better-auth/plugins";

const DEVELOPMENT_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

export function createAuth(env: CloudflareBindings) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      captcha({
        provider: "cloudflare-turnstile",
        secretKey:
          env.TURNSTILE_SECRET_KEY ||
          (import.meta.env?.DEV ? DEVELOPMENT_TURNSTILE_SECRET_KEY : ""),
        endpoints: ["/sign-up/email", "/sign-in/email"],
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth({} as CloudflareBindings);
