const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")
const pluginQuery = require("@tanstack/eslint-plugin-query")

const { LINTER_OPTIONS, TEST_FILES, TEST_RELAXED_RULES, TYPED_RULES, escalateWarnings } = require("../../eslint.typed.cjs")

const MOBILE_TYPED_RULES = {
  ...TYPED_RULES,
  // node:test's test()/describe() return promises the runner itself awaits.
  "@typescript-eslint/no-floating-promises": [
    "error",
    {
      allowForKnownSafeCalls: [
        {
          from: "package",
          package: "node:test",
          name: ["test", "describe", "it", "suite", "before", "after", "beforeEach", "afterEach"],
        },
      ],
    },
  ],
}

module.exports = defineConfig([
  ...escalateWarnings([expoConfig].flat()),
  { linterOptions: LINTER_OPTIONS },
  {
    // `scripts/*` are Node ESM dev tools, not RN app source.
    ignores: ["dist/*", ".expo/*", "node_modules/*", "expo-env.d.ts", "scripts/*"],
  },
  {
    files: ["eslint.config.js"],
    languageOptions: { globals: { __dirname: "readonly" } },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: MOBILE_TYPED_RULES,
  },
  {
    files: TEST_FILES,
    rules: TEST_RELAXED_RULES,
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: escalateWarnings(pluginQuery.configs["flat/recommended"]),
  },
])
