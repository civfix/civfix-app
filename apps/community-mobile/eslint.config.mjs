import eslintReact from "@eslint-react/eslint-plugin"
import pluginQuery from "@tanstack/eslint-plugin-query"
import expoConfig from "eslint-config-expo/flat.js"
import reactHooks from "eslint-plugin-react-hooks"
import reactNative from "eslint-plugin-react-native"
import { defineConfig } from "eslint/config"

import {
  LEAKED_RENDER_RULES,
  RAW_COLOR_EXEMPT_FILES,
  RAW_COLOR_SELECTORS,
  REACT_NATIVE_RULES,
  REACT_RULES,
  reactHooksRules,
  withoutReactHooks,
} from "../../eslint.react.cjs"
import {
  DOUBLE_CAST_SELECTORS,
  LINTER_OPTIONS,
  TEST_FILES,
  TEST_RELAXED_RULES,
  TYPED_RULES,
  escalateWarnings,
} from "../../eslint.typed.cjs"

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

export default defineConfig([
  ...escalateWarnings(withoutReactHooks([expoConfig].flat())),
  { linterOptions: LINTER_OPTIONS },
  {
    // `scripts/*` are Node ESM dev tools, not RN app source.
    ignores: ["dist/*", ".expo/*", "node_modules/*", "expo-env.d.ts", "scripts/*"],
  },
  {
    plugins: { "react-hooks": reactHooks, "react-native": reactNative },
    rules: {
      ...reactHooksRules(reactHooks),
      ...REACT_RULES,
      ...REACT_NATIVE_RULES,
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@eslint-react": eslintReact },
    rules: { ...MOBILE_TYPED_RULES, ...LEAKED_RENDER_RULES },
  },
  {
    files: TEST_FILES,
    rules: TEST_RELAXED_RULES,
  },
  {
    rules: { "no-restricted-syntax": ["error", ...RAW_COLOR_SELECTORS] },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", ...RAW_COLOR_SELECTORS, ...DOUBLE_CAST_SELECTORS] },
  },
  {
    files: RAW_COLOR_EXEMPT_FILES,
    rules: { "no-restricted-syntax": ["error", ...DOUBLE_CAST_SELECTORS] },
  },
  {
    files: TEST_FILES,
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: escalateWarnings(pluginQuery.configs["flat/recommended"]),
  },
])
