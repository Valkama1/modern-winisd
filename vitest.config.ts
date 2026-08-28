import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    // Node 22+ ships an experimental global `localStorage` that, without
    // --localstorage-file, throws/returns undefined on access. Since it's
    // already defined on globalThis before jsdom starts, vitest-environment-jsdom
    // skips overwriting it with jsdom's real localStorage implementation. Disabling
    // Node's experimental webstorage lets jsdom's localStorage populate correctly.
    execArgv: ["--no-experimental-webstorage"],
  },
});
