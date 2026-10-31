import { createRequire } from "node:module"
import eslintReact from "@eslint-react/eslint-plugin"
import nextPlugin from "@next/eslint-plugin-next"
import pluginQuery from "@tanstack/eslint-plugin-query"
import vitest from "@vitest/eslint-plugin"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"
import {
  DOUBLE_CAST_SELECTORS,
  LINTER_OPTIONS,
  TEST_FILES,
  TEST_RELAXED_RULES,
  TYPED_RULES,
  VITEST_RULES,
  escalateWarnings,
} from "../../eslint.typed.cjs"
import {
  LEAKED_RENDER_RULES,
  RAW_COLOR_EXEMPT_FILES,
  RAW_COLOR_SELECTORS,
  REACT_RULES,
  reactHooksRules,
} from "../../eslint.react.cjs"

// The react, jsx-a11y and import plugins are the exact copies the legacy `next/core-web-vitals`
// preset ran, so they resolve through eslint-config-next rather than as undeclared app dependencies.
const requireFromNextPreset = createRequire(
  createRequire(import.meta.url).resolve("eslint-config-next"),
)
const reactPlugin = requireFromNextPreset("eslint-plugin-react")
const jsxA11yPlugin = requireFromNextPreset("eslint-plugin-jsx-a11y")
const importPlugin = requireFromNextPreset("eslint-plugin-import")

const TS_FILES = ["**/*.ts", "**/*.tsx"]
const TYPED_FILES = [...TS_FILES, "scripts/**/*.mjs"]
const FUNCTIONS_TESTS = ["functions/**/*.test.ts"]

const HOST_CONSOLE_FILES = [
  "src/features/host/**",
  "src/components/console/**",
  "src/app/manage/**",
]
const HOST_CONSOLE_UI_MESSAGE =
  "The host console is plain DOM and may import ONLY @civfix/ui/data, @civfix/ui/i18n and (type-only) @civfix/ui/capabilities. Every other subpath reaches React Native."

export default tseslint.config(
  {
    ignores: [".next/**", "out/**", "public/**", "coverage/**", "next-env.d.ts"],
  },
  { linterOptions: LINTER_OPTIONS },
  ...escalateWarnings([
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
        ...reactHooksRules(reactHooks),
        ...REACT_RULES,
        ...nextPlugin.flatConfig.recommended.rules,
        ...nextPlugin.flatConfig.coreWebVitals.rules,
        ...jsxA11yPlugin.flatConfigs.strict.rules,
        "import/no-anonymous-default-export": "error",
        "react/no-unknown-property": "off",
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "jsx-a11y/alt-text": ["error", { elements: ["img"], img: ["Image"] }],
        // Deprecated in favor of label-has-associated-control, which strict already runs.
        "jsx-a11y/label-has-for": "off",
        // ConsoleLink renders an <a>, so its call sites need content too. A <Trans> slot is a SlotLink:
        // Trans supplies its text from the translation.
        "jsx-a11y/anchor-has-content": ["error", { components: ["ConsoleLink"] }],
        // A component's autoFocus prop is checked where it lands on a DOM element.
        "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
        // A fieldset's legend names the group natively; radiogroup adds the required and invalid state its
        // radios need announced. This is the one pairing the recommended preset allows and strict drops.
        "jsx-a11y/no-noninteractive-element-to-interactive-role": [
          "error",
          { fieldset: ["radiogroup"] },
        ],
        // images.unoptimized is set for the static export, so next/image would render a plain <img> anyway.
        "@next/next/no-img-element": "off",
        "react/jsx-no-target-blank": "off",
        "@typescript-eslint/no-unused-expressions": "error",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
      },
    },
  ]),
  {
    name: "community-web/typed",
    files: TYPED_FILES,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@tanstack/query": pluginQuery, "@eslint-react": eslintReact },
    rules: {
      ...Object.assign(
        {},
        ...escalateWarnings(pluginQuery.configs["flat/recommended"]).map(
          (config) => config.rules ?? {},
        ),
      ),
      ...TYPED_RULES,
      ...LEAKED_RENDER_RULES,
    },
  },
  {
    name: "community-web/raw-colors",
    rules: { "no-restricted-syntax": ["error", ...RAW_COLOR_SELECTORS] },
  },
  {
    name: "community-web/source-syntax",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", ...RAW_COLOR_SELECTORS, ...DOUBLE_CAST_SELECTORS] },
  },
  {
    // The OAuth provider logos are third-party brand marks whose colours the providers mandate.
    name: "community-web/raw-colors-exempt",
    files: [...RAW_COLOR_EXEMPT_FILES, "src/**/provider-glyphs.tsx"],
    rules: { "no-restricted-syntax": ["error", ...DOUBLE_CAST_SELECTORS] },
  },
  {
    name: "community-web/tests-syntax",
    files: TEST_FILES,
    rules: { "no-restricted-syntax": "off" },
  },
  {
    name: "community-web/tests",
    files: TEST_FILES,
    rules: TEST_RELAXED_RULES,
  },
  {
    name: "community-web/vitest",
    files: [...TEST_FILES, "scripts/**/*.test.mjs"],
    plugins: { vitest },
    rules: VITEST_RULES,
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
    // The script tests run in jsdom as well as Node, so they get their own DOM-aware project.
    name: "community-web/scripts-tests",
    files: ["scripts/**/*.test.mjs"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./scripts/tsconfig.test.json",
        tsconfigRootDir: import.meta.dirname,
      },
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
            {
              name: "@civfix/ui/realtime",
              message: "The realtime channel is mounted once by components/providers.tsx.",
            },
            {
              name: "@civfix/ui/typography",
              message: "Console typography comes from the Tailwind token scale.",
            },
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
              message:
                "Use layout/console-link.tsx: a Next transition would target a path the static manifest does not contain.",
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
