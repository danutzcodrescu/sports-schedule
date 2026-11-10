import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/bundler-plugins/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { redact } from "@tanstack/redact/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, perEnvironmentPlugin } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const uploadSourceMaps =
    command === "build" && Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

  return {
    resolve: { tsconfigPaths: true },
    build: { sourcemap: uploadSourceMaps ? "hidden" : false },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "./src/client/routes",
        generatedRouteTree: "./src/client/routeTree.gen.ts",
      }),
      viteReact(),
      redact(),
      cloudflare(),
      uploadSourceMaps &&
        perEnvironmentPlugin("sentry", (environment) =>
          sentryVitePlugin({
            org: env.SENTRY_ORG,
            project: env.SENTRY_PROJECT,
            authToken: env.SENTRY_AUTH_TOKEN,
            telemetry: false,
            sourcemaps: {
              filesToDeleteAfterUpload:
                environment.name === "client" ? ["./dist/client/**/*.map"] : undefined,
            },
          }),
        ),
    ],
  };
});
