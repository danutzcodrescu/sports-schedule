import { createMiddleware } from "hono/factory";

import type { AppEnv } from "./auth/middleware";
import type { Context, MiddlewareHandler } from "hono";

type RateLimiterBinding =
  | "API_RATE_LIMITER"
  | "GENERAL_RATE_LIMITER"
  | "MUTATION_RATE_LIMITER"
  | "SIGN_IN_RATE_LIMITER"
  | "SIGN_UP_RATE_LIMITER"
  | "SPORTS_RATE_LIMITER";

const KEY_PREFIX = "sports-schedule";

function clientIp(c: Context<AppEnv>) {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signInKey(c: Context<AppEnv>, ip: string) {
  let email = "unknown";

  try {
    const body: unknown = await c.req.raw.clone().json();

    if (
      typeof body === "object" &&
      body !== null &&
      "email" in body &&
      typeof body.email === "string"
    ) {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    // Malformed requests still share a stable per-client rate-limit key.
  }

  return `${KEY_PREFIX}:auth:sign-in:${ip}:${await hash(email)}`;
}

async function isAllowed(c: Context<AppEnv>, binding: RateLimiterBinding, key: string) {
  const { success } = await c.env[binding].limit({ key });
  return success;
}

function tooManyRequests(c: Context<AppEnv>) {
  c.header("Retry-After", "60");
  return c.json({ error: "Too many requests" }, 429);
}

export const rateLimitAuth = createMiddleware<AppEnv>(async (c, next) => {
  const ip = clientIp(c);

  if (!(await isAllowed(c, "GENERAL_RATE_LIMITER", `${KEY_PREFIX}:auth:${ip}`))) {
    return tooManyRequests(c);
  }

  if (c.req.method === "POST" && c.req.path.endsWith("/sign-in/email")) {
    if (!(await isAllowed(c, "SIGN_IN_RATE_LIMITER", await signInKey(c, ip)))) {
      return tooManyRequests(c);
    }
  }

  if (c.req.method === "POST" && c.req.path.endsWith("/sign-up/email")) {
    if (!(await isAllowed(c, "SIGN_UP_RATE_LIMITER", `${KEY_PREFIX}:auth:sign-up:${ip}`))) {
      return tooManyRequests(c);
    }
  }

  await next();
});

export const rateLimitApi = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.path.endsWith("/health")) {
    return next();
  }

  const key = `${KEY_PREFIX}:api:${clientIp(c)}`;

  if (!(await isAllowed(c, "API_RATE_LIMITER", key))) {
    return tooManyRequests(c);
  }

  await next();
});

function userRateLimit(binding: RateLimiterBinding, scope: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const key = `${KEY_PREFIX}:${scope}:${c.get("user").id}`;

    if (!(await isAllowed(c, binding, key))) {
      return tooManyRequests(c);
    }

    await next();
  };
}

export const rateLimitRead = userRateLimit("GENERAL_RATE_LIMITER", "read");
export const rateLimitSports = userRateLimit("SPORTS_RATE_LIMITER", "sports");
export const rateLimitMutation = userRateLimit("MUTATION_RATE_LIMITER", "mutation");
