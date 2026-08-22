import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      boundaries,
    },
    settings: {
      // ── Modular Monolith boundary definitions ──────────────────────────────
      //
      // Layer hierarchy (high → low, dependencies only allowed downward):
      //
      //   app  →  modules  →  shared  →  infrastructure
      //
      // Within "modules", a module may import from another module ONLY through
      // the other module's public index.ts barrel — never from internal paths.
      "boundaries/elements": [
        {
          type: "app",
          pattern: "src/app/**",
        },
        {
          type: "module",
          pattern: "src/modules/*",
          capture: ["moduleName"],
        },
        {
          type: "shared",
          pattern: "src/shared/**",
        },
        {
          type: "infrastructure",
          pattern: "src/infrastructure/**",
        },
        // Legacy layer — src/features, src/services, src/hooks, src/stores, src/pages
        // allowed to import from anywhere during incremental migration.
        // Remove this entry once migration is complete (Step 9 done).
        {
          type: "legacy",
          pattern: ["src/features/**", "src/services/**", "src/hooks/**", "src/stores/**", "src/pages/**", "src/contexts/**", "src/workers/**", "src/lib/**", "src/data/**", "src/utils/**", "src/types/**", "src/config/**", "src/components/**"],
        },
      ],
      "boundaries/ignore": ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "react-hooks/exhaustive-deps": "warn",
      // All feature/hook/context code must use logger.* from @/services/monitoring/logger.
      // console.* is only permitted inside logger.ts and infrastructure/ itself.
      "no-console": ["error", { allow: ["table", "group", "groupEnd", "groupCollapsed", "time", "timeEnd"] }],
      "prefer-const": "error",
      "no-var": "error",

      // ── Module boundary rules ─────────────────────────────────────────────
      // Enforces the layered architecture:
      //   app → modules → shared → infrastructure
      // Legacy layer covers all pre-migration code and is unrestricted
      // until Step 9 (module restructure) is complete.
      "boundaries/dependencies": ["error", {
        default: "disallow",
        rules: [
          { from: "app",            allow: ["module", "shared", "infrastructure", "legacy"] },
          { from: "module",         allow: ["shared", "infrastructure"] },
          { from: "shared",         allow: ["infrastructure"] },
          { from: "infrastructure", allow: [] },
          { from: "legacy",         allow: ["module", "shared", "infrastructure", "legacy"] },
        ],
      }],
    },
  },
);
