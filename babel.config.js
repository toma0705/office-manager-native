// Expo SDK に合った babel-preset-expo を使う。`@/` の別名は tsconfig.json の paths で Expo が解決する
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
