import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    integrations: [Sentry.browserTracingIntegration()],
  });
}
