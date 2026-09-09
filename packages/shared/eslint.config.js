import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

// Stage 0.7 (UI-unification): the @civfix/shared contract must stay framework-free. It must NEVER
// import or re-export react / react-dom / react-native (or any react-native-* lib) or @civfix/ui
// (or its subpaths). Those live only in @civfix/ui, which depends ON this package, never the reverse;
// the backend pins @civfix/shared and must not be able to pull React/RN in through it. The
// no-restricted-imports rule below (scoped to src) is the lint-time guard for that invariant.
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
      // No async work happens in this pure contract package, so this is off.
      "@typescript-eslint/no-floating-promises": "off",
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
    // Backend-isolation guard: ban UI/framework imports across the contract source tree.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: FRAMEWORK_FREE_IMPORTS,
  },
)
