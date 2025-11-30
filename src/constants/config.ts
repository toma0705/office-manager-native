import Constants from "expo-constants";

const normalize = (value: string | undefined | null) =>
  value?.replace(/\/$/, "") ?? undefined;

const resolveEnvBaseUrl = () => {
  const fromProcess = normalize(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (fromProcess) return fromProcess;

  const extra = Constants?.expoConfig?.extra as
    | { apiBaseUrl?: string }
    | undefined;
  if (extra?.apiBaseUrl) return normalize(extra.apiBaseUrl);

  const legacy = (Constants?.manifest2 as any)?.extra?.apiBaseUrl;
  if (typeof legacy === "string") return normalize(legacy);

  return undefined;
};

const DEFAULT_DEV_BASE_URL = "http://localhost:3000/api";
const DEFAULT_PROD_BASE_URL = "https://api.example.com";

export const API_BASE_URL =
  resolveEnvBaseUrl() ??
  (process.env.NODE_ENV === "development"
    ? DEFAULT_DEV_BASE_URL
    : DEFAULT_PROD_BASE_URL);

export const withApiPath = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
