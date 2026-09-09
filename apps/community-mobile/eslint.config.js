// Flat ESLint config using Expo's shared config (eslint-config-expo).
const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")

module.exports = defineConfig([
  expoConfig,
  {
    // `scripts/*` are Node ESM dev tools (e.g. branded-asset generation), not RN app source.
    ignores: ["dist/*", ".expo/*", "node_modules/*", "expo-env.d.ts", "scripts/*"],
  },
])
