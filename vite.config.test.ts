import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuilder, createLogger } from "vite";

test("Sentry configuration hooks run for client and Worker builds", async (context) => {
  // Enable the deployment configuration with dummy credentials. Creating a builder
  // resolves plugins but never builds, uploads source maps, or deploys the Worker.
  for (const key of ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]) {
    const previous = process.env[key];
    process.env[key] = "smoke-test-no-upload";
    context.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }

  const warnings: string[] = [];
  const logger = createLogger("silent");
  logger.warn = logger.warnOnce = (message) => {
    warnings.push(message);
  };

  const builder = await createBuilder({ customLogger: logger });

  assert.deepEqual(
    warnings.filter((message) => message.includes("Vite-specific hooks")),
    [],
    "Sentry configuration hooks must not be ignored by Vite",
  );
  assert.ok(builder.environments.client);
  assert.ok(Object.values(builder.environments).some((env) => env.config.consumer === "server"));
  for (const environment of Object.values(builder.environments)) {
    assert.equal(environment.config.build.sourcemap, "hidden");
    assert.equal(
      environment.plugins.filter((plugin) => plugin.name === "sentry-vite-plugin").length,
      1,
    );
  }
});
