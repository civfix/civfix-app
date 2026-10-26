const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")
const pluginQuery = require("@tanstack/eslint-plugin-query")

const TYPED_RULES = {
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

// Clients read legal versions from the API; the contract's helpers serve the backend (DECISIONS §66).
const LEGAL_HELPER_NAMES = ["currentVersion", "legalDocument", "isCurrent", "currentLegalVersion", "LEGAL_DOCUMENTS"]
const LEGAL_HELPER_PATHS = ["@civfix/contract", "@civfix/contract/legal"].map((name) => ({
  name,
  importNames: LEGAL_HELPER_NAMES,
  message: "Legal versions come from the API (useLegalDocuments in @civfix/ui/data); this helper is backend only.",
}))

module.exports = defineConfig([
  expoConfig,
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
    rules: TYPED_RULES,
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [pluginQuery.configs["flat/recommended"]],
  },
  {
    rules: {
      "no-restricted-imports": ["error", { paths: LEGAL_HELPER_PATHS }],
    },
  },
])
