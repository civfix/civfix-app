import eslint from "@eslint/js"
import pluginQuery from "@tanstack/eslint-plugin-query"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

const BANNED_PATTERNS = [
  { group: ["expo", "expo-*", "expo/*"], message: "expo-* is platform-native; import it only in a *.native.* seam file." },
  { group: ["maplibre-react-native", "maplibre-react-native/*"], message: "maplibre is platform-bound; import it only in a *.native.*/*.web.* map seam file." },
  { group: ["@maplibre/*"], message: "maplibre is platform-bound; import it only in a *.native.*/*.web.* map seam file." },
]
const NATIVE_ONLY_PATTERNS = [
  { group: ["react-native-reanimated", "react-native-reanimated/*"], message: "react-native-reanimated is worklet-based and crashes the web (RNW) bundle; import it only in a *.native.* seam file." },
  { group: ["@gorhom/bottom-sheet", "@gorhom/bottom-sheet/*"], message: "@gorhom/bottom-sheet pulls in reanimated worklets; import it only in a *.native.* seam file." },
  { group: ["react-native-video", "react-native-video/*"], message: "react-native-video has no web build; import it only in a *.native.* seam file (the web seam uses an HTML5 <video>)." },
]
const BANNED_PATHS = [
  { name: "@expo/vector-icons", message: "Use lucide-react-native via @civfix/ui/typography instead of @expo/vector-icons." },
  { name: "maplibre-gl", message: "maplibre-gl is web-only; import it only in a *.web.* map seam file." },
  { name: "next", message: "next/* is web-app-only and must not leak into @civfix/ui." },
]
const BANNED_PATH_PATTERNS = [{ group: ["next/*"], message: "next/* is web-app-only and must not leak into @civfix/ui." }]

const RN_FREE_FILES = ["src/theme/schemes.ts", "src/primitives/externalUrls.ts"]
const RN_FREE_PATHS = [
  { name: "react", message: "This module is published as an RN-free subpath; it must not import react." },
  { name: "react-dom", message: "This module is published as an RN-free subpath; it must not import react-dom." },
  { name: "react-native", message: "This module is published as an RN-free subpath; it must not import react-native." },
]
const RN_FREE_PATTERNS = [
  { group: ["react/*", "react-dom/*"], message: "This module is published as an RN-free subpath; it must not import react." },
  { group: ["react-native/*", "react-native-*"], message: "This module is published as an RN-free subpath; it must not import react-native." },
]

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
    ignores: ["dist-types/**", "node_modules/**", "*.config.js", "*.config.ts", "vitest.dom.setup.ts", "scripts/**"],
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
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  ...pluginQuery.configs["flat/recommended"],
  {
    rules: {
      // The injected API client, query client and geolocation capability are stable per provider and
      // never part of a query's identity, so they stay out of every query key.
      "@tanstack/query/exhaustive-deps": [
        "error",
        { allowlist: { variables: ["api", "qc", "geo"], types: ["ApiClient", "QueryClient"] } },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...BANNED_PATHS],
          patterns: [...BANNED_PATTERNS, ...BANNED_PATH_PATTERNS, ...NATIVE_ONLY_PATTERNS],
        },
      ],
    },
  },
  {
    files: ["src/**/*.web.tsx", "src/**/*.web.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@expo/vector-icons", message: "Use lucide-react-native via @civfix/ui/typography instead of @expo/vector-icons." },
            { name: "next", message: "next/* is web-app-only and must not leak into @civfix/ui." },
          ],
          patterns: [...BANNED_PATH_PATTERNS, ...NATIVE_ONLY_PATTERNS],
        },
      ],
    },
  },
  {
    files: ["src/**/*.native.tsx", "src/**/*.native.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@expo/vector-icons", message: "Use lucide-react-native via @civfix/ui/typography instead of @expo/vector-icons." },
            { name: "next", message: "next/* is web-app-only and must not leak into @civfix/ui." },
          ],
          patterns: [...BANNED_PATH_PATTERNS],
        },
      ],
    },
  },
  {
    files: RN_FREE_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...BANNED_PATHS, ...RN_FREE_PATHS],
          patterns: [...BANNED_PATTERNS, ...BANNED_PATH_PATTERNS, ...NATIVE_ONLY_PATTERNS, ...RN_FREE_PATTERNS],
        },
      ],
    },
  },
)
