import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setupFiles: ["./vitest.console-guard.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**"],
      reporter: ["text-summary"],
      // The measured baseline rounded down; raise these as coverage grows, never lower them.
      thresholds: { lines: 100, functions: 100, branches: 76, statements: 100 },
    },
  },
})
