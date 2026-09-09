// Babel config for the Expo app.
//
// NOTE on the worklets plugin: with react-native-reanimated v4 the worklet Babel transform moved
// out of "react-native-reanimated/plugin" into "react-native-worklets/plugin" (a separate package
// that Reanimated v4 depends on). It must remain the LAST plugin in the list so it can see the
// fully transformed output of every other plugin. (On Reanimated v3 this entry was
// "react-native-reanimated/plugin"; SDK 54 ships Reanimated v4, so we use the worklets plugin.)
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  }
}
