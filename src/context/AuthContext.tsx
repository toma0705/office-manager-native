import {
  type UsersLoginPostRequest,
  type UserSafe,
} from "@office-manager/api-client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createUsersApi } from "@/api/client";
import { tokenStorage } from "@/storage/tokenStorage";

type AuthStatus = "checking" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: UserSafe | null;
  token: string | null;
  signIn: (credentials: UsersLoginPostRequest) => Promise<void>;
  signOut: () => Promise<void>;
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
      const result = await api.usersLoginPost({
        usersLoginPostRequest: { email, password },
      });
      await tokenStorage.set(result.token);
      setToken(result.token);
      setUser(result.user);
      setStatus("signedIn");
    },
    []
  );

  const signOut = useCallback(async () => {
    await tokenStorage.remove();
    setToken(null);
    setUser(null);
    setStatus("signedOut");
  }, []);

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
