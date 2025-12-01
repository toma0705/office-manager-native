import * as SecureStore from "expo-secure-store";
import type { UsersLoginPostRequest } from "@office-manager/api-client";

type StoredCredentials = UsersLoginPostRequest;

const CREDENTIAL_KEY = "office_manager_credentials";

const sanitizeCredentials = (
  credentials: Partial<UsersLoginPostRequest> | null | undefined
): StoredCredentials | null => {
  if (!credentials) return null;

  const emailValue = credentials.email;
  const passwordValue = credentials.password;

  if (emailValue === undefined || passwordValue === undefined) {
    return null;
  }

  const email =
    typeof emailValue === "string" ? emailValue : String(emailValue ?? "");
  const password =
    typeof passwordValue === "string"
      ? passwordValue
      : String(passwordValue ?? "");

  if (!email || !password) {
    return null;
  }

  return { email, password };
};

export const credentialStorage = {
  get: async (): Promise<StoredCredentials | null> => {
    try {
      const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
      if (__DEV__) {
        console.log("[credentialStorage] loaded raw", raw);
      }
      if (!raw) return null;
      const parsed = sanitizeCredentials(JSON.parse(raw));
      if (__DEV__) {
        console.log("[credentialStorage] parsed", parsed);
      }
      if (!parsed) {
        await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn("Failed to load login credentials", error);
      return null;
    }
  },
  set: async (credentials: StoredCredentials): Promise<void> => {
    try {
      const sanitized = sanitizeCredentials(credentials);
      if (__DEV__) {
        console.log("[credentialStorage] saving", sanitized);
      }
      if (!sanitized) {
        await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
        return;
      }
      await SecureStore.setItemAsync(
        CREDENTIAL_KEY,
        JSON.stringify(sanitized),
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
