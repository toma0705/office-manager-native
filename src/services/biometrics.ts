/**
 * Face ID などの生体認証
 * - アプリを開いたとき: 本人か確かめてから、保存しているログインを使う（AuthContext）
 * - ログイン画面: 保存しているメールアドレスとパスワードでログインする（LoginScreen）
 */
import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";

/** Expo Go（開発用のアプリ）では生体認証を使えない。普通にビルドしたアプリでは true */
export const canUseBiometrics = Constants.appOwnership !== "expo";

export const EXPO_GO_BIOMETRICS_MESSAGE =
  "Expo Go では顔認証を利用できません。通常ログインをご利用ください。";

export type BiometricResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no-hardware" // 端末が対応していない
        | "not-enrolled" // 端末で Face ID などを設定していない
        | "missing-usage-description" // Info.plist に NSFaceIDUsageDescription がない
        | "cancelled"
        | "failed";
    };

export const authenticateWithBiometrics = async (
  promptMessage: string
): Promise<BiometricResult> => {
  if (!(await LocalAuthentication.hasHardwareAsync())) {
    return { ok: false, reason: "no-hardware" };
  }
  if (!(await LocalAuthentication.isEnrolledAsync())) {
    return { ok: false, reason: "not-enrolled" };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "キャンセル",
    fallbackLabel: "パスコードを入力",
    disableDeviceFallback: false,
  });
  // Info.plist に NSFaceIDUsageDescription がないと、Face ID の代わりに警告が返る
  const warning = (result as { warning?: unknown }).warning;
  if (
    typeof warning === "string" &&
    warning.includes("NSFaceIDUsageDescription")
  ) {
    return { ok: false, reason: "missing-usage-description" };
  }
  if (result.success) return { ok: true };
  return {
    ok: false,
    reason:
      result.error && result.error !== "user_cancel" ? "failed" : "cancelled",
  };
};
