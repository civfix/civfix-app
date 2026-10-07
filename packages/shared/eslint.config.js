import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

// The @civfix/shared contract must stay framework-free: never import or re-export react / react-dom /
// react-native (or any react-native-* lib) or @civfix/ui. @civfix/ui depends ON this package, never the
// reverse, and the backend pins @civfix/shared and must not be able to pull React/RN in through it.
const FRAMEWORK_FREE_IMPORTS = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "react", message: "@civfix/shared must stay framework-free; React belongs in @civfix/ui." },
        { name: "react-dom", message: "@civfix/shared must stay framework-free; react-dom belongs in @civfix/ui." },
        { name: "react-native", message: "@civfix/shared must stay framework-free; react-native belongs in @civfix/ui." },
        { name: "@civfix/ui", message: "@civfix/shared must not depend on @civfix/ui (the dependency runs the other way)." },
      ],
      patterns: [
        {
          group: ["react-native-*"],
          message: "@civfix/shared must stay framework-free; react-native-* libs belong in @civfix/ui.",
        },
        {
          group: ["@civfix/ui/*"],
          message: "@civfix/shared must not depend on @civfix/ui subpaths (the dependency runs the other way).",
        },
      ],
    },
  ],
}

const TYPED_RULES = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: true } }],
  // A `default` branch is a deliberate catch-all; the rule only has to catch a switch that silently
  // falls through to undefined when a union grows.
  "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
  "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
}

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js", "*.config.ts"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
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
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: FRAMEWORK_FREE_IMPORTS,
  },
)
