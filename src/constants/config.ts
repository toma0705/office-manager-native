// import Constants from "expo-constants";

// // 末尾の スラッシュ（/）を自動で削除するヘルパー関数
// const normalize = (value: string | undefined | null) =>
//   value?.replace(/\/$/, "") ?? undefined;

// // さまざまなソースから環境変数の取得を試みる関数
// const resolveEnvBaseUrl = () => {
//   // 1. .env や環境変数から最優先で取得 (EXPO_PUBLIC_API_BASE_URL)
//   const fromProcess = normalize(process.env.EXPO_PUBLIC_API_BASE_URL);
//   if (fromProcess) return fromProcess;

//   // 2. app.json / app.config.js の extra セクションから取得
//   const extra = Constants?.expoConfig?.extra as
//     | { apiBaseUrl?: string }
//     | undefined;
//   if (extra?.apiBaseUrl) return normalize(extra.apiBaseUrl);

//   // 3. 過去のExpoバージョンとの互換性（レガシーなマニフェスト）
//   const legacy = (Constants?.manifest2 as any)?.extra?.apiBaseUrl;
//   if (typeof legacy === "string") return normalize(legacy);

//   return undefined;
// };

// // 開発環境（ローカル）と本番環境（Vercel）のフォールバック用URL
// const DEFAULT_DEV_BASE_URL = "http://localhost:3000/api";
// const DEFAULT_PROD_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// // 最終的なAPIのベースURLを決定
// // NODE_ENV ではなく、Expoが確実に保証する __DEV__ グローバル定数を使用して判定します
// export const API_BASE_URL =
//   resolveEnvBaseUrl() ??
//   (__DEV__ ? DEFAULT_DEV_BASE_URL : DEFAULT_PROD_BASE_URL);
export const API_BASE_URL = "https://okayama-office-manager.vercel.app/api";
// // 各エンドポイントへのパスを結合するヘルパー関数
export const withApiPath = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
