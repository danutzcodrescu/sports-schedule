import * as Sentry from "@sentry/react";

export function initializeSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!import.meta.env.PROD || !dsn) return false;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });
  return true;
}

export const sentryErrorHandlers = {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
};

export function captureRouteError(error: unknown) {
  Sentry.captureException(error);
}
