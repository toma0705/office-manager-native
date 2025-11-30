import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "office-manager/token";

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.warn("Failed to load auth token", error);
      return null;
    }
  },
  set: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.warn("Failed to persist auth token", error);
    }
  },
  remove: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.warn("Failed to remove auth token", error);
    }
  },
};
