import type { CloudflareOptions } from "@sentry/cloudflare";

export function workerSentryOptions(env: CloudflareBindings): CloudflareOptions {
  return {
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN),
    environment: env.SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
  };
}
