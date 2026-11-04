import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service temps réel compilé par `bun run build:realtime`.
    "dist/**",
    "playwright-report/**",
    "test-results/**",
    // Dossiers de travail isolés des agents Claude Code : chacun est une copie
    // complète du dépôt, avec son propre .next et ses node_modules.
    ".claude/**",
  ]),
]);

export default eslintConfig;
