import eslint from "@eslint/js"
import vitest from "@vitest/eslint-plugin"
import tseslint from "typescript-eslint"
import { LINTER_OPTIONS, TEST_FILES, TEST_RELAXED_RULES, TYPED_RULES, VITEST_RULES } from "../../eslint.typed.cjs"

export default tseslint.config(
  {
    ignores: ["node_modules/**", "coverage/**", "*.config.js", "*.config.ts"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: LINTER_OPTIONS,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: TYPED_RULES,
  },
  {
    files: TEST_FILES,
    plugins: { vitest },
    rules: { ...TEST_RELAXED_RULES, ...VITEST_RULES },
  },
)
