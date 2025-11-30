# Office Manager Native

Expo + React Native 版の Office Manager クライアントです。Web 版 (`office-manager-next`) の機能を可能な限り踏襲しつつ、モバイル操作に合わせた UI へ最適化しています。

## 主な機能

- JWT 認証によるログイン・ログアウト
- 新規ユーザー登録（アイコン画像アップロード対応）
- パスワードリセット申請・再設定
- 入退室の管理と Discord 通知連携
- オフィス別ユーザー一覧表示、メモ編集

## ディレクトリ構成

```
src/
  api/                // OpenAPI クライアントの薄いラッパー
  components/         // UI コンポーネントと画面専用ブロック
  context/            // AuthContext 等の状態管理
  hooks/              // 共通フック
  navigation/         // React Navigation 設定
  screens/            // 画面コンポーネント
  storage/            // AsyncStorage ラッパー
  theme/              // カラーパレット等
  utils/              // フォーマット関数
```

## セットアップ

1. 依存関係をインストールします。社内 Git（`@office-manager/api-client`）へアクセスできる SSH 鍵を設定した上で実行してください。

   ```bash
   npm install
   ```

2. API ベース URL を環境変数で指定します（例: ホストしている Next.js API）。

   ```bash
   echo "EXPO_PUBLIC_API_BASE_URL=https://example.com/api" >> .env
   ```

   ローカル開発で Next.js を同じマシンで動かす場合はトンネルツール（`ngrok` 等）で公開 URL を用意し、上記に設定してください。

3. Expo を起動します。

   ```bash
   npm run start
   ```

   iOS シミュレータ、Android エミュレータ、Expo Go から動作確認できます。

## 補足

- 依存追加に伴い `babel.config.js` に `module-resolver` を導入し、`@/` プレフィックスで `src/` を参照できるようにしています。
- 認証トークンは `AsyncStorage` 下に保存し、アプリ起動時に自動復元します。
- Web 版で `fetch` を直接呼び出している `enter/exit` などの API は、同様に REST エンドポイントへリクエストする実装にしています（OpenAPI クライアント未提供のため）。
- `npm install` 実行時に private Git リポジトリへアクセスできない場合は、いったん `@office-manager/api-client` をローカルパスに差し替えるなどの対応を行ってください。

## 今後の改善候補

- EAS Build を想定したビルド設定・スクリプト追加
- Detox 等を用いた E2E テスト
- デザインシステムの共通化（`@office-manager/ui` 的なライブラリ化）
- オフライン対応やエラートーストの導入
