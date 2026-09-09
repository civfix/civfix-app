import { createRequire } from "node:module"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const require = createRequire(import.meta.url)
const packageDir = (name: string): string => dirname(require.resolve(`${name}/package.json`))

const reactDir = packageDir("react")
const reactDomDir = packageDir("react-dom")
const reactQueryDir = packageDir("@tanstack/react-query")

const DOM_TESTS = "src/**/*.dom.test.tsx"

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        inline: [/@civfix\/ui/, /react-i18next/],
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
            "scripts/**/*.test.mjs",
            "functions/**/*.test.ts",
          ],
          exclude: ["**/node_modules/**", "**/dist/**", DOM_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [DOM_TESTS],
        },
      },
    ],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactDir },
      { find: /^react\/(.*)$/, replacement: `${reactDir}/$1` },
      { find: /^react-dom$/, replacement: reactDomDir },
      { find: /^react-dom\/(.*)$/, replacement: `${reactDomDir}/$1` },
      { find: /^@tanstack\/react-query$/, replacement: reactQueryDir },
      { find: /^@\//, replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` },
    ],
  },
})
