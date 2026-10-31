# 入退室管理（iOS・Android アプリ）

IT 学生団体 PlayGround のオフィスに「今だれがいるか」を確認できるアプリの、iOS・Android 版です。
オフィスに置いたビーコン（ESP32）を検知して、**アプリを閉じていても自動で入退室**を記録します。

> 引き継ぎの全体像は web の [docs/handover.md](https://github.com/toma0705/okayama-office-manager/blob/main/docs/handover.md) を読んでください。

| リポジトリ                                                                          | 内容                                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [okayama-office-manager](https://github.com/toma0705/okayama-office-manager)（web） | Web の画面と API。このアプリはこの API を使う                               |
| **office-manager-native**（これ）                                                   | iOS・Android アプリ（Expo / React Native）                                  |
| [office-manager-api-client](https://github.com/toma0705/office-manager-api-client)  | API を呼ぶための TypeScript クライアント（web の OpenAPI 仕様から自動生成） |

## 技術スタック

| 項目     | 使っているもの                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| アプリ   | Expo SDK 54・React Native 0.81（New Architecture）・TypeScript                                                            |
| 画面遷移 | React Navigation（native-stack）                                                                                          |
| API      | `@office-manager/api-client`（タグを指定してインストール）                                                                |
| ビーコン | 自作の Expo モジュール `modules/office-beacon`（iOS: CoreLocation、Android: AltBeacon + WorkManager）                     |
| 保存     | AsyncStorage（ログイン用トークン・ビーコン用の情報）、SecureStore（Face ID でのログインに使うメールアドレスとパスワード） |
| テスト   | Jest（jest-expo）、JUnit（Android のネイティブ）                                                                          |

## 自動入退室のしくみ

```
OS がビーコンの圏内・圏外を知らせる（アプリが終了していても OS がアプリを起こす）
  ├─ iOS:     JS（src/services/backgroundBeacon.ts）が受け取る
  └─ Android: ネイティブ（AttendanceWorker.kt）が受け取る（JS が動かないことがあるため）
→ サーバーの在室状態（/users/me）と照らして、/arrive（圏内）か /leave（圏外）を呼ぶ
→ サーバーが保留にし、時間が過ぎたら確定して Discord に通知する（入室は 1 分、退室は 15 分）
```

どの API を呼ぶかの判定は、iOS（[src/services/beacon/attendanceDecision.ts](src/services/beacon/attendanceDecision.ts)）と Android（[AttendanceDecision.kt](modules/office-beacon/android/src/main/java/expo/modules/officebeacon/AttendanceDecision.kt)）の両方にあります。
どちらも同じ表 [modules/office-beacon/test-fixtures/attendance-decisions.json](modules/office-beacon/test-fixtures/attendance-decisions.json) でテストしているので、**判定を変えるときは表と両方のコードを直してください**（片方だけ変えるとテストが落ちます）。

自動入退室には次の許可が必要です（ホーム画面を開いたときに求めます）。

- 位置情報の「常に許可」（iBeacon の検知は位置情報サービスの一部）
- Android 12 以降: 「付近のデバイス」（Bluetooth のスキャン）
- Android: Google Play のポリシーにより、許可を求める前にアプリ内で用途を説明して同意をもらう

アプリを開いたとき・前面に戻ったときにも、ビーコンの状態とサーバーの状態を照らし直します（Web で手動で入退室を変えた場合のずれを直すため）。

## 開発を始める

必要なもの: Node.js 22、Xcode（iOS）、CocoaPods、JDK 17 と Android Studio（Android）。

```bash
npm ci
echo "EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api" > .env   # 接続先の API
npx expo run:ios       # iOS シミュレーターで起動（初回は ios フォルダを作るので時間がかかる）
npx expo run:android   # Android エミュレーターで起動
```

- API はローカルの web（`npm run dev`）に繋ぐのがおすすめです。web の README の手順で起動すると、`dev@4nonome.com` / `local-dev-password` でログインできます。
- `.env` を作らずにビルドすると、本番の API（`https://okayama-office-manager.vercel.app/api`）に繋ぎます。
- ビーコンの検知はシミュレーターでは動きません（「この実行環境ではビーコン検知を利用できません」と出ます）。実機で確かめます。
- Expo Go では動きません（自作のネイティブモジュールを使っているため）。

## よく使うコマンド

| コマンド                                                   | 内容                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npx expo run:ios` / `npx expo run:android`                | ビルドして起動                                                          |
| `npm test`                                                 | テスト（Jest）                                                          |
| `npm run lint`                                             | ESLint                                                                  |
| `npm run format`                                           | Prettier で整形                                                         |
| `npm run typecheck`                                        | 型チェック                                                              |
| `cd android && ./gradlew :office-beacon:testDebugUnitTest` | Android のネイティブの単体テスト（先に `npx expo prebuild -p android`） |

## テストと CI

| ワークフロー                                                  | 内容                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [CI](.github/workflows/ci.yml)                                | PR ごとに ESLint・Prettier・型チェック・Jest                                    |
| [Android 単体テスト](.github/workflows/android-unit-test.yml) | `modules/office-beacon` などを変えたときだけ、Kotlin の単体テスト（数分かかる） |

テストは各フォルダの `__tests__` にあります。画面から切り出した処理（判定・設定・保存・許可の流れ）を中心に確かめています。

## ディレクトリ構成

```
src/
  App.tsx                 画面の一番外側。backgroundBeacon を最初に読み込む
  api/client.ts           API クライアント（api-client）を作る
  context/AuthContext.tsx ログイン状態（useAuth）
  navigation/             画面の切り替え
  screens/                画面
  components/             画面の部品（ui/ は共通の部品）
  services/
    backgroundBeacon.ts   自動入退室（監視の開始・ビーコンのイベント）
    beacon/               判定・API・許可・説明文
    biometrics.ts         Face ID などの生体認証
  storage/                端末への保存（トークン・ログイン情報・ビーコン用の情報）
  constants/              API の接続先・オフィスのビーコンの設定
modules/office-beacon/    ビーコンを検知するネイティブモジュール（ios/・android/・src/）
plugins/                  ネイティブの設定を書き換える Expo の設定プラグイン
firmware/                 オフィスに置くビーコン（ESP32）のプログラム
scripts/                  リリース用のスクリプト
```

## ネイティブの設定（ios・android フォルダ）

`ios/` と `android/` は `npx expo prebuild` が `app.config.js` と `plugins/` から作る**生成物**で、git には入れていません。
手で直しても作り直すと消えるので、ネイティブの設定を変えるときは `app.config.js` か `plugins/` に書きます。設定を変えたら `npx expo prebuild --clean` で作り直してください。

| プラグイン                     | 内容                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `withSceneLifecycle.js`        | iOS: SceneDelegate を使う起動の仕方にする（新しい iOS で必要）                  |
| `withPodsDeploymentTarget.js`  | iOS: すべての Pod の最低 OS を 15.1 に上げる（新しい Xcode で必要）             |
| `withAndroidBeaconManifest.js` | Android: ビーコンのライブラリの常駐通知（フォアグラウンドサービス）の宣言を外す |
| `withAndroidReleaseSigning.js` | Android: `~/.gradle/gradle.properties` の鍵でリリース用に署名する               |
| `withAndroidGradleMemory.js`   | Android: ビルドのメモリを増やす（足りずに失敗するため）                         |

## オフィスのビーコンを増やす

1. ESP32 に [firmware/office_beacon/office_beacon.ino](firmware/office_beacon/office_beacon.ino) を書き込む（Arduino IDE、ESP32 のボード（Arduino-ESP32 core 3.x））。オフィスごとに `BEACON_MAJOR` / `BEACON_MINOR` を変える
2. [src/constants/beacon.ts](src/constants/beacon.ts) に、オフィスのコードとビーコンの UUID・major・minor を足す
3. web 側にもそのオフィスがあることを確かめる（web の docs/operations.md の「オフィスを増やす」）
4. アプリを出し直す

検知する範囲は、ファームウェアの `TX_POWER_LEVEL`（送信出力）で調整します。

## テストモード（実機での確認用）

```bash
OFFICE_MANAGER_TEST_MODE=1 npx expo prebuild --clean
OFFICE_MANAGER_TEST_MODE=1 npx expo run:android --variant release
```

検知と記録の結果を端末に通知します（Android のみ。iOS はホーム画面に表示が出るだけ）。入退室の確定はサーバーが行うので、Discord にも通知されます。
**テストモードのままストアに出さないでください。** 元に戻すときは `npx expo prebuild --clean` で作り直します（通知の許可の宣言が残るため）。

## リリース

先に API（web）を本番に出してから、アプリを出します。ストアのアプリは全員がすぐに更新するわけではないので、API は古いアプリでも動くようにしておきます。

### バージョンの上げ方（`app.config.js`）

| 項目                  | ルール                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `version`             | ストアに出すたびに上げる（例: 3.0.2 → 3.0.3）。App Store は審査を通ったバージョンに新しいビルドを足せない |
| `ios.buildNumber`     | iOS のビルドを上げるたびに 1 つ増やす                                                                     |
| `android.versionCode` | Android のビルドを上げるたびに 1 つ増やす                                                                 |

### iOS

```bash
scripts/release-ios.sh
```

ビルドして App Store Connect にアップロードします（Xcode に Apple Developer のチームのアカウントでログインしておく）。
そのあと App Store Connect で、新しいバージョンを作ってビルドを選び、審査に出します。審査用のデモアカウントが DB にあることを確かめてください。

### Android

`~/.gradle/gradle.properties` にアップロード鍵の設定を書いておきます（鍵ファイルとパスワードは非公開の引き継ぎ資料を見てください）。

```properties
OFFICE_MANAGER_UPLOAD_STORE_FILE=/Users/<あなた>/.android-keystores/office-manager-upload.jks
OFFICE_MANAGER_UPLOAD_STORE_PASSWORD=...
OFFICE_MANAGER_UPLOAD_KEY_ALIAS=...
OFFICE_MANAGER_UPLOAD_KEY_PASSWORD=...
```

```bash
scripts/release-android.sh   # build/office-manager-<version>-<versionCode>.aab ができる
```

Google Play Console で新しいリリースを作り、AAB をアップロードします。今は「内部テスト」で配っています（本番に出すには、12 人以上で 14 日間のクローズドテストが必要）。

## 困ったとき

- **`pod install` が `Unicode Normalization not appropriate for ASCII-8BIT` で失敗する**: `export LANG=en_US.UTF-8` をしてからやり直す
- **ネイティブの設定が反映されない・ビルドが変**: `npx expo prebuild --clean` で ios・android フォルダを作り直す
- **Android のビルドがメモリ不足で落ちる**: `cd android && ./gradlew --stop` で Gradle を止めてからやり直す
- **API の型が古い**: `package.json` の `@office-manager/api-client` のタグを上げて `npm install`
