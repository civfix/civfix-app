import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import { LINTER_OPTIONS, TEST_FILES, TEST_RELAXED_RULES, TYPED_RULES } from "../../eslint.typed.cjs"

// @civfix/tokens must stay framework-free: never import or re-export react / react-dom /
// react-native (or any react-native-* lib) or @civfix/ui. @civfix/ui depends ON this package, never the
// reverse, and the backend installs @civfix/tokens for its email layout and must not pull React/RN in through it.
const FRAMEWORK_FREE_IMPORTS = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "react", message: "@civfix/tokens must stay framework-free; React belongs in @civfix/ui." },
        { name: "react-dom", message: "@civfix/tokens must stay framework-free; react-dom belongs in @civfix/ui." },
        { name: "react-native", message: "@civfix/tokens must stay framework-free; react-native belongs in @civfix/ui." },
        { name: "@civfix/ui", message: "@civfix/tokens must not depend on @civfix/ui (the dependency runs the other way)." },
      ],
      patterns: [
        {
          group: ["react-native-*"],
          message: "@civfix/tokens must stay framework-free; react-native-* libs belong in @civfix/ui.",
        },
        {
          group: ["@civfix/ui/*"],
          message: "@civfix/tokens must not depend on @civfix/ui subpaths (the dependency runs the other way).",
        },
      ],
    },
  ],
}

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.ts", "*.config.bundled_*.mjs"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: LINTER_OPTIONS,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
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
    rules: TYPED_RULES,
  },
  {
    files: TEST_FILES,
    rules: TEST_RELAXED_RULES,
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: FRAMEWORK_FREE_IMPORTS,
  },
)
