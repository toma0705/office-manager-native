import AsyncStorage from "@react-native-async-storage/async-storage";

const TEST_MODE_KEY = "office-manager/test-mode";

/**
 * テストモード: オンの間は Discord への通知を送らず、端末のローカル通知で代用する。
 * バックグラウンド処理からも読めるよう AsyncStorage に保存する。
 */
export const testModeStorage = {
  get: async (): Promise<boolean> => {
    try {
      return (await AsyncStorage.getItem(TEST_MODE_KEY)) === "1";
    } catch (error) {
      console.warn("Failed to load test mode", error);
      return false;
    }
  },
  set: async (enabled: boolean): Promise<void> => {
    try {
      if (enabled) await AsyncStorage.setItem(TEST_MODE_KEY, "1");
      else await AsyncStorage.removeItem(TEST_MODE_KEY);
    } catch (error) {
      console.warn("Failed to save test mode", error);
    }
  },
};
