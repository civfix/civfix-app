// The React rule set the civfix-app workspaces enforce, next to eslint.typed.cjs and CommonJS for the
// same reason. Each config registers the plugins itself; this module only names the rules.
//
// Off on purpose, measured on this code: react/jsx-no-leaked-render (not type-aware, so it flags plain
// booleans; the typed @eslint-react rule below covers the real crash), react/jsx-no-useless-fragment,
// react-native/no-inline-styles (web-only CSS has to be inline on RN styles) and
// react-native/no-unused-styles (false positives on StyleSheet factories).

// Off because every hit measured was intended code:
// - refs flags the latest-ref pattern and immutability flags reanimated `.value` writes (281 and 57 in ui).
// - set-state-in-effect flags the post-commit state a static export and its native shell depend on: reading
//   window.location or storage after hydration, mount latches that keep a body alive once shown, and
//   resets that run beside Animated, reanimated or MapLibre work (62 across ui, web and mobile). Moving them
//   into render changes when bodies mount and breaks hydration.
// - preserve-manual-memoization only matters to the React Compiler, which neither app runs; its 13 hits are
//   dependency lists deliberately narrower than the compiler's inference (`profile?.id`, not `profile`).
const REACT_HOOKS_OFF = new Set([
  "react-hooks/refs",
  "react-hooks/immutability",
  "react-hooks/set-state-in-effect",
  "react-hooks/preserve-manual-memoization",
])

// Every recommended react-hooks v7 rule at error, including the ones the plugin ships as warnings.
function reactHooksRules(reactHooksPlugin) {
  const recommended = reactHooksPlugin.configs.flat["recommended-latest"].rules
  return Object.fromEntries(
    Object.keys(recommended).map((name) => [name, REACT_HOOKS_OFF.has(name) ? "off" : "error"]),
  )
}

// eslint-config-expo 10 registers react-hooks v5, and which copy a preset loads is up to module resolution,
// so its plugin and rules are dropped and the pinned v7 is the only one.
function withoutReactHooks(configs) {
  return configs.map((config) => {
    const { plugins, rules, ...rest } = config
    const { "react-hooks": _reactHooks, ...otherPlugins } = plugins ?? {}
    return {
      ...rest,
      ...(plugins && { plugins: otherPlugins }),
      ...(rules && {
        rules: Object.fromEntries(Object.entries(rules).filter(([name]) => !name.startsWith("react-hooks/"))),
      }),
    }
  })
}

const REACT_RULES = {
  "react/jsx-key": ["error", { checkFragmentShorthand: true, warnOnDuplicates: true }],
  "react/no-unstable-nested-components": "error",
  "react/jsx-no-constructed-context-values": "error",
  "react/no-array-index-key": "error",
}

// A `0` or `""` rendered by `cond && <View/>` is text outside <Text>, which crashes React Native; so is a
// stray `$` before `{value}` or `;` after a JSX expression.
const LEAKED_RENDER_RULES = {
  "@eslint-react/no-leaked-conditional-rendering": "error",
  "@eslint-react/jsx-no-leaked-dollar": "error",
  "@eslint-react/jsx-no-leaked-semicolon": "error",
}

const REACT_NATIVE_RULES = {
  "react-native/no-color-literals": "error",
}

module.exports = { reactHooksRules, withoutReactHooks, REACT_RULES, LEAKED_RENDER_RULES, REACT_NATIVE_RULES }
