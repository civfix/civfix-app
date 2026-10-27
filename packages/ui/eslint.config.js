import eslintReact from "@eslint-react/eslint-plugin"
import eslint from "@eslint/js"
import pluginQuery from "@tanstack/eslint-plugin-query"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import reactNative from "eslint-plugin-react-native"
import tseslint from "typescript-eslint"
import {
  LEAKED_RENDER_RULES,
  RAW_COLOR_EXEMPT_FILES,
  RAW_COLOR_SELECTORS,
  REACT_NATIVE_RULES,
  REACT_RULES,
  reactHooksRules,
} from "../../eslint.react.cjs"
import { LINTER_OPTIONS, TEST_FILES, TEST_RELAXED_RULES, TYPED_RULES, escalateWarnings } from "../../eslint.typed.cjs"

const BANNED_PATTERNS = [
  { group: ["expo", "expo-*", "expo/*"], message: "expo-* is platform-native; import it only in a *.native.* seam file." },
  { group: ["maplibre-react-native", "maplibre-react-native/*"], message: "maplibre is platform-bound; import it only in a *.native.*/*.web.* map seam file." },
  { group: ["@maplibre/*"], message: "maplibre is platform-bound; import it only in a *.native.*/*.web.* map seam file." },
]
const NATIVE_ONLY_PATTERNS = [
  { group: ["react-native-reanimated", "react-native-reanimated/*"], message: "react-native-reanimated is worklet-based and crashes the web (RNW) bundle; import it only in a *.native.* seam file." },
  { group: ["react-native-worklets", "react-native-worklets/*"], message: "react-native-worklets crashes the web (RNW) bundle; import it only in a *.native.* seam file." },
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

export default tseslint.config(
  {
    ignores: ["dist-types/**", "node_modules/**", "*.config.js", "*.config.ts", "vitest.dom.setup.ts", "scripts/**"],
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
    plugins: { "react-hooks": reactHooks, react, "react-native": reactNative, "@eslint-react": eslintReact },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooksRules(reactHooks),
      ...REACT_RULES,
      ...REACT_NATIVE_RULES,
      ...LEAKED_RENDER_RULES,
    },
  },
  ...escalateWarnings(pluginQuery.configs["flat/recommended"]),
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
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", ...RAW_COLOR_SELECTORS] },
  },
  {
    files: RAW_COLOR_EXEMPT_FILES,
    rules: { "no-restricted-syntax": "off" },
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
