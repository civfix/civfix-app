import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import {
  LINTER_OPTIONS,
  NODE_TEST_FOCUS_SELECTORS,
  NODE_TEST_TYPED_RULES,
  TYPED_RULES,
} from "./eslint.typed.cjs"

// The workspace-root build and CI scripts. Each workspace lints its own tree with its own config.
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    linterOptions: LINTER_OPTIONS,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...TYPED_RULES,
      ...NODE_TEST_TYPED_RULES,
      // checkJs already reports an undeclared name, and knows Node's globals.
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["scripts/**/*.test.mjs"],
    rules: { "no-restricted-syntax": ["error", ...NODE_TEST_FOCUS_SELECTORS] },
  },
)
