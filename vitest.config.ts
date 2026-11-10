import { redact } from "@tanstack/redact/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact(), redact()],
  test: {
    // Keep third-party React imports on Redact, including Testing Library's CJS imports.
    server: { deps: { inline: true } },
    deps: { optimizer: { client: { enabled: true, include: ["@testing-library/react"] } } },
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.integration.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
