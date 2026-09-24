// The worklets plugin must stay last so it sees every other plugin's output.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  }
}
