import { defineConfig } from "vitest/config";

/**
 * Performance benchmarks, kept out of the normal suite so `npm test` stays fast.
 * Run with `npm run bench`.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.bench.tsx", "src/**/*.bench.ts"],
    execArgv: ["--no-experimental-webstorage"],
  },
});
