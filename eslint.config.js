import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * The linter the code already assumed it had.
 *
 * Four `// eslint-disable-next-line react-hooks/exhaustive-deps` comments were sitting
 * in src/ with no ESLint installed to read them — someone expected this file to exist.
 * `exhaustive-deps` is an error rather than a warning for that reason: it is the rule
 * those comments were written against, and the one that catches a stale closure reading
 * yesterday's props.
 */
export default tseslint.config(
  { ignores: ["dist", "src-tauri", "node_modules", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── Standing backlog ───────────────────────────────────────────────────
      // These four are warnings rather than errors because they have existing
      // violations, not because they are unimportant. Erroring today would mean
      // either a red CI on arrival — which teaches everyone to ignore it — or
      // rushing fixes that belong to work already scoped elsewhere. Each is
      // recorded with its count so the number can only go down.
      //
      // exhaustive-deps (5) — three of the five want `getGraphXLimits`, which
      //   useGraphViewport recreates every render. Adding it to a dep array as-is
      //   re-runs the whole sweep on every render. The fix is the provider-value
      //   memoisation in the performance work; flip this to error with it, since
      //   this rule is what catches that class of bug in the first place.
      // static-components (13) — components declared inside another component's
      //   body, so React destroys and recreates the subtree every render.
      //   CustomTopologyDiagram's Block and Arrow are the worst of them.
      // set-state-in-effect (5) — setState called synchronously in an effect body.
      // only-export-components (14) — mostly the eight near-identical context
      //   files, which the structural pass replaces wholesale.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // An unused parameter is often a signature being kept in shape; an unused local
      // is not. `_`-prefixed names are the escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Build-time scripts run under Node, not in the webview.
    files: ["scripts/**", "*.config.{js,ts}", "vite.config.ts", "vitest*.config.ts"],
    languageOptions: { globals: globals.node },
  },
);
