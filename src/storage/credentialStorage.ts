import * as SecureStore from "expo-secure-store";
import type { UsersLoginPostRequest } from "@office-manager/api-client";

type StoredCredentials = UsersLoginPostRequest;

const CREDENTIAL_KEY = "office_manager_credentials";

export const credentialStorage = {
  get: async (): Promise<StoredCredentials | null> => {
    try {
      const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredCredentials;
    } catch (error) {
      console.warn("Failed to load login credentials", error);
      return null;
    }
  },
  set: async (credentials: StoredCredentials): Promise<void> => {
    try {
      await SecureStore.setItemAsync(
        CREDENTIAL_KEY,
        JSON.stringify(credentials),
        {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        }
      );
    } catch (error) {
      console.warn("Failed to persist login credentials", error);
    }
  },
  remove: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
    } catch (error) {
      console.warn("Failed to remove login credentials", error);
    }
  },
};
