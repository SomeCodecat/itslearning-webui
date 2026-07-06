import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next plus generated/runtime artifacts.
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "prisma/**",
    "storage/**",
    "migration_backup/**",
    "scripts/**",
    "test_db*.ts",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
