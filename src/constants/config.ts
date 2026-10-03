import Constants from "expo-constants";

const normalize = (value: string | undefined | null) =>
  value?.replace(/\/$/, "") ?? undefined;

const extractHost = (value: string | undefined | null) => {
  if (!value) return undefined;
  return value.split(":")[0];
};

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

const resolveExpoHostBaseUrl = () => {
  const expoConfigHost = extractHost(
    (Constants?.expoConfig as { hostUri?: string } | null | undefined)?.hostUri
  );
  if (expoConfigHost) {
    return `http://${expoConfigHost}:3000/api`;
  }

  const expoGoDebuggerHost = extractHost(
    (
      Constants?.expoGoConfig as { debuggerHost?: string } | null | undefined
    )?.debuggerHost
  );
  if (expoGoDebuggerHost) {
    return `http://${expoGoDebuggerHost}:3000/api`;
  }

  const legacyHost = extractHost(
    (
      Constants?.manifest2 as
        | { extra?: { expoClient?: { hostUri?: string } } }
        | null
        | undefined
    )?.extra?.expoClient?.hostUri
  );
  if (legacyHost) {
    return `http://${legacyHost}:3000/api`;
  }

  return undefined;
};

const DEFAULT_DEV_BASE_URL = "http://localhost:3000/api";
const DEFAULT_PROD_BASE_URL = "https://okayama-office-manager.vercel.app/api";

export const API_BASE_URL =
  resolveEnvBaseUrl() ??
  resolveExpoHostBaseUrl() ??
  (process.env.NODE_ENV === "development"
    ? DEFAULT_DEV_BASE_URL
    : DEFAULT_PROD_BASE_URL);

export const withApiPath = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
