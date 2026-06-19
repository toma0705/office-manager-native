import {
  type UsersLoginPostRequest,
  type UserSafe,
} from "@office-manager/api-client";
import Constants from "expo-constants";
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
import {
  syncBackgroundAttendanceSnapshot,
  stopBackgroundAttendanceMonitoring,
} from "@/services/backgroundGeofencing";
import * as Location from "expo-location"; // 👈 インポート完了

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

// 💡 バックグラウンド位置情報の権限を確認・要求するヘルパー関数
const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    // 1. まずはフォアグラウンド（アプリ起動中）の権限を確認・要求
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      console.warn("【権限】フォアグラウンド位置情報の権限が拒否されました");
      return false;
    }

    // 2. 次にバックグラウンド（アプリが閉じている間）の権限を確認・要求
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== "granted") {
      console.warn("【権限】バックグラウンド位置情報の権限が拒否されました");
      return false;
    }

    return true;
  } catch (error) {
    console.error("【権限】位置情報の権限要求中にエラーが発生しました:", error);
    return false;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<UserSafe | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const shouldRequireBiometric = Constants.appOwnership !== "expo";

  const loadSession = useCallback(async () => {
    setStatus("checking");
    const stored = await tokenStorage.get();
    if (!stored) {
      try {
        await stopBackgroundAttendanceMonitoring();
      } catch (e) {
        console.warn("Failed to stop background monitoring during logout", e);
      }
      setToken(null);
      setUser(null);
      setStatus("signedOut");
      return;
    }
    try {
      let biometricApproved = true;

      if (shouldRequireBiometric) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          biometricApproved = false;
        }
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          biometricApproved = false;
        } else if (biometricApproved) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Face IDでロック解除",
            cancelLabel: "キャンセル",
            fallbackLabel: "パスコードを入力",
            disableDeviceFallback: false,
          });
          const warningMessage = (result as { warning?: unknown }).warning;
          if (
            typeof warningMessage === "string" &&
            warningMessage.includes("NSFaceIDUsageDescription")
          ) {
            biometricApproved = false;
          } else {
            biometricApproved = result.success;
          }
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

      // 📌 修正: 権限をチェックしてから同期。エラーや権限不足でもセッション復元は失敗させない
      const hasPermission = await requestLocationPermissions();
      if (hasPermission) {
        try {
          await syncBackgroundAttendanceSnapshot(stored, profile.user);
        } catch (error) {
          console.warn(
            "Background attendance sync skipped during loadSession",
            error,
          );
        }
      }

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
  }, [shouldRequireBiometric]);

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

      // 📌 修正: ログイン成功時に位置情報の権限を要求し、OKなら同期を開始する
      const hasPermission = await requestLocationPermissions();
      if (hasPermission) {
        try {
          await syncBackgroundAttendanceSnapshot(result.token, result.user);
        } catch (error) {
          console.warn(
            "Background attendance sync skipped during signIn",
            error,
          );
        }
      }

      setToken(result.token);
      setUser(result.user);
      setStatus("signedIn");
    },
    [],
  );

  const signOut = useCallback(
    async (options?: { forgetCredentials?: boolean }) => {
      const tasks = [tokenStorage.remove()];
      if (options?.forgetCredentials) {
        tasks.push(credentialStorage.remove());
      }
      await Promise.all(tasks);

      try {
        await stopBackgroundAttendanceMonitoring();
      } catch (e) {
        console.warn("Failed to stop background monitoring during signOut", e);
      }

      setToken(null);
      setUser(null);
      setStatus("signedOut");
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const api = createUsersApi(token);
      const profile = await api.usersMeGet();

      // 📌 修正: リフレッシュ時も権限を確認してから同期する
      const hasPermission = await requestLocationPermissions();
      if (hasPermission) {
        try {
          await syncBackgroundAttendanceSnapshot(token, profile.user);
        } catch (error) {
          console.warn(
            "Background attendance sync skipped during refreshUser",
            error,
          );
        }
      }

      setUser(profile.user);
      setStatus("signedIn");
    } catch (error) {
      console.warn("Failed to refresh user", error);
      await signOut();
    }
  }, [signOut, token]);

  const setUserState = useCallback(
    (next: UserSafe | null) => {
      if (token && next) {
        // 📌 修正: 状態変更時も権限を確認してから同期する
        void requestLocationPermissions().then((hasPermission) => {
          if (hasPermission) {
            try {
              void syncBackgroundAttendanceSnapshot(token, next);
            } catch (error) {
              console.warn(
                "Background attendance sync skipped during setUserState",
                error,
              );
            }
          }
        });
      }
      setUser(next);
      setStatus(next ? "signedIn" : "signedOut");
    },
    [token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, signIn, signOut, refreshUser, setUserState }),
    [refreshUser, signIn, signOut, status, token, user, setUserState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuthContext must be used within AuthProvider");
  return context;
};
