// The typed rule set the civfix-app workspaces enforce. CommonJS so any config, ESM or CommonJS, can load
// it without a loader flag.
//
// Off on purpose, measured on this code: no-unnecessary-condition (the contract client passes through
// bodies that fail their schema, so the guards on them are deliberate), strict-boolean-expressions,
// no-confusing-void-expression, require-await, promise-function-async, unbound-method and
// no-unnecessary-type-arguments, which flag mostly correct code or pure style.

const TYPED_RULES = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: true } }],
  // A `default` branch is a deliberate catch-all; the rule only has to catch a switch that silently
  // falls through to undefined when a union grows.
  "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
  "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-declaration-merging": "error",
  "@typescript-eslint/no-unsafe-enum-comparison": "error",
  "@typescript-eslint/no-unsafe-function-type": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unsafe-unary-minus": "error",
  "@typescript-eslint/no-deprecated": [
    "error",
    {
      // By name: a package specifier matches on the attribute's value type, which a JSX prop never carries.
      // react-native-svg's Rect redeclares x/y as its position, but the rule reads the deprecated transform
      // x/y they shadow. react-native-web 0.21 ignores submitBehavior, so blurOnSubmit still keeps a web
      // input focused on submit.
      allow: ["x", "y", "blurOnSubmit"],
    },
  ],
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  // On a string or a boolean, `||` deliberately treats "" and false as absent (a blank title falls back,
  // `invalid || undefined` drops a false ARIA attribute), which `??` would not; every such hit measured
  // here was that idiom.
  "@typescript-eslint/prefer-nullish-coalescing": ["error", { ignorePrimitives: { string: true, boolean: true } }],
  "@typescript-eslint/prefer-promise-reject-errors": "error",
  "@typescript-eslint/only-throw-error": "error",
  "@typescript-eslint/no-base-to-string": "error",
  "@typescript-eslint/no-misused-spread": "error",
  "@typescript-eslint/no-dynamic-delete": "error",
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
  "@typescript-eslint/restrict-plus-operands": [
    "error",
    { allowAny: false, allowBoolean: false, allowNullish: false, allowNumberAndString: false, allowRegExp: false },
  ],
  "@typescript-eslint/restrict-template-expressions": [
    "error",
    {
      allowNumber: true,
      allowAny: false,
      allowArray: false,
      allowBoolean: false,
      allowNever: false,
      allowNullish: false,
      allowRegExp: false,
    },
  ],
}

const TEST_FILES = [
  "**/__tests__/**",
  "**/__testing__/**",
  "**/__fixtures__.ts",
  "**/*.test.ts",
  "**/*.test.tsx",
  "tests/**",
  "vitest.setup.ts",
]

// Test doubles and fixtures lean on loose casts and asserted lookups; source code gets no such slack.
const TEST_RELAXED_RULES = {
  "@typescript-eslint/no-non-null-assertion": "off",
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-declaration-merging": "off",
  "@typescript-eslint/no-unsafe-enum-comparison": "off",
  "@typescript-eslint/no-unsafe-function-type": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/no-unsafe-unary-minus": "off",
}

const LINTER_OPTIONS = { reportUnusedDisableDirectives: "error" }

const isWarn = (severity) => severity === "warn" || severity === 1

// Presets (next, expo) ship rules at "warn"; every rule here is either an error or off.
function escalateWarnings(configs) {
  return configs.map((config) => {
    if (!config.rules) return config
    const rules = Object.fromEntries(
      Object.entries(config.rules).map(([name, entry]) => {
        if (Array.isArray(entry) && isWarn(entry[0])) return [name, ["error", ...entry.slice(1)]]
        return [name, isWarn(entry) ? "error" : entry]
      }),
    )
    return { ...config, rules }
  })
}

module.exports = { TYPED_RULES, TEST_FILES, TEST_RELAXED_RULES, LINTER_OPTIONS, escalateWarnings }
