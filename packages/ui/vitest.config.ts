import { configDefaults, defineConfig } from "vitest/config"

const DOM_TESTS = "src/**/*.dom.test.{ts,tsx}"
// Listed first so its afterEach runs last and also sees what other hooks' cleanup logs.
const CONSOLE_GUARD = "./vitest.console-guard.ts"

// The event form keeps an event-zone wall clock in device-local Dates, so a fixture like 02:30 on a US
// spring-forward night only exists on a device outside that gap. Pin the device zone to CI's UTC so a run
// on a US-zoned machine exercises the same fixtures; the workers inherit it.
process.env.TZ = "UTC"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/__testing__/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text-summary"],
      // The measured baseline rounded down; raise these as coverage grows, never lower them.
      thresholds: { lines: 37, functions: 37, branches: 34, statements: 37 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: [...configDefaults.exclude, DOM_TESTS],
          setupFiles: [CONSOLE_GUARD],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [DOM_TESTS],
          setupFiles: [CONSOLE_GUARD, "./vitest.dom.setup.ts"],
        },
        resolve: {
          alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
        },
      },
    ],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
})
