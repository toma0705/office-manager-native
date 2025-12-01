import {
  type UsersLoginPostRequest,
  type UserSafe,
} from "@office-manager/api-client";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createUsersApi } from "@/api/client";
import { credentialStorage } from "@/storage/credentialStorage";
import { tokenStorage } from "@/storage/tokenStorage";

type AuthStatus = "checking" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: UserSafe | null;
  token: string | null;
  signIn: (credentials: UsersLoginPostRequest) => Promise<void>;
  signOut: (options?: { forgetCredentials?: boolean }) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserState: (user: UserSafe | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<UserSafe | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setStatus("checking");
    const stored = await tokenStorage.get();
    if (!stored) {
      setToken(null);
      setUser(null);
      setStatus("signedOut");
      return;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      let biometricApproved = true;
      if (hasHardware) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (enrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Face IDでロック解除",
            cancelLabel: "キャンセル",
            fallbackLabel: "パスコードを入力",
            disableDeviceFallback: false,
          });
          biometricApproved = result.success;
        }
      }

      if (!biometricApproved) {
        await Promise.all([tokenStorage.remove(), credentialStorage.remove()]);
        setToken(null);
        setUser(null);
        setStatus("signedOut");
        return;
      }

      const api = createUsersApi(stored);
      const profile = await api.usersMeGet();
      setToken(stored);
      setUser(profile.user);
      setStatus("signedIn");
    } catch (error) {
      console.warn("Failed to restore session", error);
      await tokenStorage.remove();
      setToken(null);
      setUser(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const signIn = useCallback(
    async ({ email, password }: UsersLoginPostRequest) => {
      const api = createUsersApi();
      const payload: UsersLoginPostRequest = {
        email,
        password,
      };
      const result = await api.usersLoginPost({
        usersLoginPostRequest: payload,
      });
      await Promise.all([
        tokenStorage.set(result.token),
        credentialStorage.set(payload),
      ]);
      setToken(result.token);
      setUser(result.user);
      setStatus("signedIn");
    },
    []
  );

  const signOut = useCallback(
    async (options?: { forgetCredentials?: boolean }) => {
      const tasks = [tokenStorage.remove()];
      if (options?.forgetCredentials) {
        tasks.push(credentialStorage.remove());
      }
      await Promise.all(tasks);
      setToken(null);
      setUser(null);
      setStatus("signedOut");
    },
    []
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const api = createUsersApi(token);
      const profile = await api.usersMeGet();
      setUser(profile.user);
      setStatus("signedIn");
    } catch (error) {
      console.warn("Failed to refresh user", error);
      await signOut();
    }
  }, [signOut, token]);

  const setUserState = useCallback((next: UserSafe | null) => {
    setUser(next);
    setStatus(next ? "signedIn" : "signedOut");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, signIn, signOut, refreshUser, setUserState }),
    [refreshUser, signIn, signOut, status, token, user, setUserState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuthContext must be used within AuthProvider");
  return context;
};
