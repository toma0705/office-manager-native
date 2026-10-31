import Constants from "expo-constants";

/** 本番の API（.env の EXPO_PUBLIC_API_BASE_URL が未設定のときに使う） */
export const PRODUCTION_API_BASE_URL =
  "https://okayama-office-manager.vercel.app/api";

type ConfigSources = {
  /** .env の EXPO_PUBLIC_API_BASE_URL（開発中に Metro から読まれる） */
  envBaseUrl?: string;
  /** app.config.js の extra.apiBaseUrl（Release ビルドにはこちらが埋め込まれる） */
  extraBaseUrl?: string;
  /** 開発中に Metro を動かしている PC（例: 192.168.0.10:8081） */
  devHostUri?: string;
  isDevelopment: boolean;
};

const trimSlash = (value: string) => value.replace(/\/$/, "");

/**
 * API の接続先を決める。.env の値 → app.config.js の値 → 開発中なら Metro の PC の 3000 番 → 本番 の順。
 */
export const resolveApiBaseUrl = ({
  envBaseUrl,
  extraBaseUrl,
  devHostUri,
  isDevelopment,
}: ConfigSources) => {
  const configured = envBaseUrl || extraBaseUrl;
  if (configured) return trimSlash(configured);
  if (isDevelopment) {
    const host = devHostUri?.split(":")[0] || "localhost";
    return `http://${host}:3000/api`;
  }
  return PRODUCTION_API_BASE_URL;
};

const extra = Constants.expoConfig?.extra as
  { apiBaseUrl?: string; testMode?: boolean } | undefined;

export const API_BASE_URL = resolveApiBaseUrl({
  envBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  extraBaseUrl: extra?.apiBaseUrl,
  devHostUri: Constants.expoConfig?.hostUri,
  isDevelopment: process.env.NODE_ENV === "development",
});

export const withApiPath = (path: string, baseUrl = API_BASE_URL) =>
  `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * 実機確認用のテストモード（app.config.js の OFFICE_MANAGER_TEST_MODE）。
 * 検知と記録の結果を端末の通知で知らせる（Android のみ）。入退室の確定はサーバーが行うので、Discord にも通知される。
 */
export const TEST_MODE = extra?.testMode === true;
