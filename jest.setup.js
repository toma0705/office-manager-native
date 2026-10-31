// テスト全体の準備。端末の機能（保存領域など）はテストでは使えないので、メモリ上の代わりにする
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    WHEN_UNLOCKED: "WHEN_UNLOCKED",
    getItemAsync: jest.fn(async key => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async key => {
      store.delete(key);
    }),
  };
});
