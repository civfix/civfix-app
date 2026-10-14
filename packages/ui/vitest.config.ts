import { configDefaults, defineConfig } from "vitest/config"

const DOM_TESTS = "src/**/*.dom.test.{ts,tsx}"

// The event form keeps an event-zone wall clock in device-local Dates, so a fixture like 02:30 on a US
// spring-forward night only exists on a device outside that gap. Pin the device zone to CI's UTC so a run
// on a US-zoned machine exercises the same fixtures; the workers inherit it.
process.env.TZ = "UTC"

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: [...configDefaults.exclude, DOM_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [DOM_TESTS],
          setupFiles: ["./vitest.dom.setup.ts"],
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
