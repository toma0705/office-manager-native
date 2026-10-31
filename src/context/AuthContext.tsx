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
import {
  stopBackgroundAttendanceMonitoring,
  syncBackgroundAttendanceSnapshot,
} from "@/services/backgroundBeacon";
import {
  authenticateWithBiometrics,
  canUseBiometrics,
} from "@/services/biometrics";
import { credentialStorage } from "@/storage/credentialStorage";
import { tokenStorage } from "@/storage/tokenStorage";

type AuthStatus = "checking" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: UserSafe | null;
  token: string | null;
  signIn: (credentials: UsersLoginPostRequest) => Promise<void>;
  signOut: (options?: { forgetCredentials?: boolean }) => Promise<void>;
  /** 画面で取り直したユーザー情報を反映する */
  setUserState: (user: UserSafe | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<UserSafe | null>(null);
  const [token, setToken] = useState<string | null>(null);

  /** アプリを開いたとき、保存しているログインを使う（Face ID などで本人か確かめてから） */
  const loadSession = useCallback(async () => {
    setStatus("checking");
    const stored = await tokenStorage.get();
    if (!stored) {
      await stopBackgroundAttendanceMonitoring();
      setToken(null);
      setUser(null);
      setStatus("signedOut");
      return;
    }
    try {
      // 生体認証を使えない・失敗・キャンセルなら、保存しているログインを消してログイン画面に戻す
      if (
        canUseBiometrics &&
        !(await authenticateWithBiometrics("Face IDでロック解除")).ok
      ) {
        await Promise.all([tokenStorage.remove(), credentialStorage.remove()]);
        setToken(null);
        setUser(null);
        setStatus("signedOut");
        return;
      }

      const api = createUsersApi(stored);
      const profile = await api.usersMeGet();
      await syncBackgroundAttendanceSnapshot(stored, profile.user);
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
      const normalizedEmail = String(email ?? "").trim();
      const normalizedPassword = String(password ?? "").trim();
      if (!normalizedEmail || !normalizedPassword) {
        throw new Error("Invalid credentials provided");
      }
      const api = createUsersApi();
      const payload: UsersLoginPostRequest = {
        email: normalizedEmail,
        password: normalizedPassword,
      };
      const result = await api.usersLoginPost({
        usersLoginPostRequest: payload,
      });
      await Promise.all([
        tokenStorage.set(result.token),
        credentialStorage.set(payload),
      ]);
      await syncBackgroundAttendanceSnapshot(result.token, result.user);
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
      await stopBackgroundAttendanceMonitoring();
      setToken(null);
      setUser(null);
      setStatus("signedOut");
    },
    []
  );

  const setUserState = useCallback(
    (next: UserSafe | null) => {
      if (token && next) {
        void syncBackgroundAttendanceSnapshot(token, next);
      }
      setUser(next);
      setStatus(next ? "signedIn" : "signedOut");
    },
    [token]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, signIn, signOut, setUserState }),
    [signIn, signOut, status, token, user, setUserState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth は AuthProvider の中で使ってください");
  return context;
};
