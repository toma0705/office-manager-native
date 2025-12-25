# Office Manager Native

これは Office Manager プロジェクトの一部です
Web アプリのリポジトリはこちら:[office-manager-web](https://github.com/toma0705/okayama-office-manager)
Web/Native 双方から同じバックエンド API を利用するための OpenAPI リポジトリはこちら:[office-manager-api-client](https://github.com/toma0705/office-manager-api-client)

## 技術スタックと選定理由

| 技術                         | バージョン/ライブラリ                                        | 選定理由                                                                                                      |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| React Native + Expo          | React Native 0.81 / Expo 54                                  | OTA 更新やビルド自動化が容易で、ネイティブ設定を Expo Config で一元管理できるため。                           |
| TypeScript                   | ~5.9                                                         | 既存 Web 版と型定義を共有しやすく、API クライアントの型安全性を担保できるため。                               |
| React Navigation             | v6 Stack                                                     | ネイティブ UX に沿ったスタック遷移が素早く実装でき、Deep Link 対応もしやすい。                                |
| Expo Local Authentication    | ~17.0                                                        | Face ID / Touch ID による再認証フローを統一的に扱えるため。                                                   |
| AsyncStorage & SecureStore   | @react-native-async-storage/async-storage, expo-secure-store | アクセストークンは SecureStore、UI で再利用する資格情報は AsyncStorage に保存し、プラットフォーム差異を吸収。 |
| `@office-manager/api-client` | private Git リポジトリ                                       | Web 版の OpenAPI 定義から生成したクライアントを流用することで、API 仕様差分をなくし保守性を高める。           |

## 機能概要

- **認証**: JWT によるログイン/ログアウト、SecureStore へのトークン保存、再起動時の自動復元。
- **新規登録**: アバター画像アップロード、所属オフィス選択、`@4nonome.com` ドメイン限定のメールアドレスバリデーション。
- **パスワードリセット**: メール送信によるリセット依頼と、トークン付きリンクからの再設定 UI。
- **入退室管理**: Web 版と同様の REST エンドポイントを呼び出し、Discord 通知連携を維持。
- **ユーザー一覧/メモ**: オフィスごとのユーザーを表示し、ステータスやメモを編集。
- **生体認証**: 保存済み資格情報に対する Face ID / Touch ID ログイン（アプリ配布ビルドのみ）。

## 技術的なポイント

- **OpenAPI クライアントの共通化**: Web 版で使用していた OpenAPI 定義から `@office-manager/api-client` を生成。Native 版でも同一クライアントを npm 依存として読み込み、API 変更を一元管理できるようにしています。
- **Native 仕様の UI**: Web 版で使用していた UI をあえて使わず Native 専用の UI を作りました。
- **資格情報の二層管理**: トークンは `expo-secure-store`、メール/パスワードは暗号化不要の `AsyncStorage` に保持し、Face ID 認証時に再利用。ユーザーの手動ログアウト時には両方を確実に削除するよう `AuthContext` を設計しています。
- **Expo Config によるネイティブ設定**: `app.config.js` で Bundle ID、`NSFaceIDUsageDescription`、Splash などを定義。`expo prebuild` 実行後も Git 管理せず再生成可能な構成にしています。
- **UI モジュール化**: 画面共通のフォーム、レイアウト、配色を `components/` と `theme/` に集約し、Web 版とのコンポーネント共有も視野に入れた構成にしています。

## ディレクトリ構成

```
src/
  api/                // OpenAPI クライアントの薄いラッパー
  components/         // UI コンポーネントと画面専用ブロック
  context/            // AuthContext 等の状態管理
  hooks/              // 共通フック
  navigation/         // React Navigation 設定
  screens/            // 画面コンポーネント
  storage/            // SecureStore / AsyncStorage ラッパー
  theme/              // カラーパレット等
  utils/              // フォーマット関数
```

## 実機検証時の注意点

- **Face ID / Touch ID**: Expo Go では生体認証 API がサポートされないため、`expo run:ios` や EAS Build で実機向けバイナリを作成してください。ビルド後、端末側で Face ID を有効化しておく必要があります。
- **Metro バンドラ**: Xcode から Debug ビルドを実行する場合は別途 `npm run start` で Metro を起動し続けてください（Debug 構成では JS バンドルを同梱しないため）。
- **Pod 同期**: `expo install` / `npm install` でネイティブ依存を追加した後は必ず `npx pod-install` を実行。Pod が古いままだと生体認証や SecureStore が読み込めないケースがあります。
- **環境変数**: `.env` の `EXPO_PUBLIC_API_BASE_URL` はビルド時に静的に展開されます。実機テスト用に本番/ステージングなど適切なエンドポイントに切り替えてください。
