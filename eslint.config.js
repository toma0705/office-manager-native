// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      "android/*",
      "ios/*",
      "modules/office-beacon/android/build/*",
      "coverage/*",
    ],
  },
  {
    // テスト: jest の関数を使え、jest.mock を import より先に書ける
    files: ["jest.setup.js", "**/__tests__/**"],
    languageOptions: { globals: require("globals").jest },
    rules: { "import/first": "off" },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // 使っていない変数・import は消す。わざと受け取るだけの引数は `_` で始める
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
