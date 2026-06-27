// Primary test runner: `bun test` (see package.json "test" script).
// This vitest config exists for coverage generation only — vitest cannot
// resolve `bun:test` imports used by 400+ test files, so it is NOT used
// as a test runner. Coverage: `bun run vitest --run --coverage`.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/app/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
