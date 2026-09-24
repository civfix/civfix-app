import { createRequire } from "node:module"
import nextPlugin from "@next/eslint-plugin-next"
import pluginQuery from "@tanstack/eslint-plugin-query"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

// The react, jsx-a11y and import plugins are the exact copies the legacy `next/core-web-vitals`
// preset ran, so they resolve through eslint-config-next rather than as undeclared app dependencies.
const requireFromNextPreset = createRequire(createRequire(import.meta.url).resolve("eslint-config-next"))
const reactPlugin = requireFromNextPreset("eslint-plugin-react")
const jsxA11yPlugin = requireFromNextPreset("eslint-plugin-jsx-a11y")
const importPlugin = requireFromNextPreset("eslint-plugin-import")

const TS_FILES = ["**/*.ts", "**/*.tsx"]
const TYPED_FILES = [...TS_FILES, "scripts/**/*.mjs"]
const FUNCTIONS_TESTS = ["functions/**/*.test.ts"]

const HOST_CONSOLE_FILES = ["src/features/host/**", "src/components/console/**", "src/app/manage/**"]
const HOST_CONSOLE_UI_MESSAGE =
  "The host console is plain DOM and may import ONLY @civfix/ui/data, @civfix/ui/i18n and (type-only) @civfix/ui/capabilities. Every other subpath reaches React Native."

export default tseslint.config(
  {
    ignores: [".next/**", "out/**", "public/**", "next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    name: "community-web/next-core-web-vitals",
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11yPlugin,
      import: importPlugin,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.flatConfig.recommended.rules,
      ...nextPlugin.flatConfig.coreWebVitals.rules,
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "react/jsx-no-target-blank": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    name: "community-web/typed",
    files: TYPED_FILES,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@tanstack/query": pluginQuery },
    rules: {
      ...Object.assign({}, ...pluginQuery.configs["flat/recommended"].map((config) => config.rules ?? {})),
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: true } }],
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-unary-minus": "error",
    },
  },
  {
    // Pages Functions tests import node:fs and vitest, which the Workers-only functions/tsconfig.json
    // deliberately cannot see, so they get their own project.
    name: "community-web/functions-tests",
    files: FUNCTIONS_TESTS,
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./functions/tsconfig.test.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    name: "community-web/scripts",
    files: ["scripts/**/*.mjs"],
    rules: {
      // The build scripts are untyped JavaScript: type-aware linting guards their promise handling,
      // while every value TypeScript cannot infer is `any` by construction.
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    name: "community-web/host-console",
    files: HOST_CONSOLE_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@civfix/ui", message: HOST_CONSOLE_UI_MESSAGE },
            { name: "@civfix/ui/bodies", message: HOST_CONSOLE_UI_MESSAGE },
            { name: "@civfix/ui/nav", message: HOST_CONSOLE_UI_MESSAGE },
            {
              name: "@civfix/ui/theme",
              message:
                "@civfix/ui/theme's barrel imports react-native. Use @civfix/ui/theme/schemes (the RN-free subpath) for scheme names and palettes, and lib/color-scheme.ts to read the same `.dark` class the --console-* variables key off.",
            },
            { name: "@civfix/ui/surface", message: HOST_CONSOLE_UI_MESSAGE },
            { name: "@civfix/ui/realtime", message: "The realtime channel is mounted once by components/providers.tsx." },
            { name: "@civfix/ui/typography", message: "Console typography comes from the Tailwind token scale." },
            {
              name: "@civfix/ui/capabilities",
              message:
                "Capabilities are React-Native-shaped. Type-only imports are allowed; use @/lib/web-camera for the console's own camera seam.",
              allowTypeImports: true,
            },
            {
              name: "next/navigation",
              message:
                "The console is one static shell served by the SPA fallback: navigate with components/console/url-state.ts, never a Next route transition.",
            },
            {
              name: "next/link",
              message: "Use layout/console-link.tsx: a Next transition would target a path the static manifest does not contain.",
            },
            { name: "next/router", message: "The console is App Router + its own history bridge." },
            { name: "maplibre-gl", message: "The console renders no map." },
          ],
          patterns: [
            {
              group: [
                "react-native",
                "react-native/*",
                "react-native-*",
                "react-native-*/**",
                "@gorhom/*",
                "@shopify/react-native-*",
              ],
              message: "The host console is plain DOM: no React Native, ever.",
            },
            {
              group: ["@civfix/ui/*/*", "@civfix/ui/*/**", "!@civfix/ui/theme/schemes"],
              message:
                "The host console is plain DOM and may import ONLY @civfix/ui/data, @civfix/ui/i18n, @civfix/ui/theme/schemes and (type-only) @civfix/ui/capabilities. Every other subpath reaches React Native. Nested subpaths (e.g. surface/liquidGlass) are React-Native and Skia.",
            },
            { group: ["maplibre-gl/*", "maplibre-gl/**"], message: "The console renders no map." },
          ],
        },
      ],
    },
  },
)
