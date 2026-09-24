import { configDefaults, defineConfig } from "vitest/config"

const DOM_TESTS = "src/**/*.dom.test.{ts,tsx}"

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
