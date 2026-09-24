const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")

module.exports = defineConfig([
  expoConfig,
  {
    // `scripts/*` are Node ESM dev tools, not RN app source.
    ignores: ["dist/*", ".expo/*", "node_modules/*", "expo-env.d.ts", "scripts/*"],
  },
])
