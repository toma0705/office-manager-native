// 実機確認用のテストモード（ビルド時に OFFICE_MANAGER_TEST_MODE=1 を指定する）。
// 検知と記録の結果を端末の通知で知らせる（入退室の確定はサーバーが行うので、Discord にも通知される）。
// 本番のビルドでは使わない
const TEST_MODE = process.env.OFFICE_MANAGER_TEST_MODE === "1";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "入退室管理",
  owner: "toma0705",
  slug: "office-manager-native",
  version: "3.0.2",
  orientation: "portrait",
  icon: "./assets/office-manager-icon.png",
  userInterfaceStyle: "light",
  updates: {
    url: "https://u.expo.dev/98a48421-8173-486e-92b8-71d9569e2b77",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.toma0705.officemanager",
    buildNumber: "16",
    icon: "./assets/office-manager-icon.png",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // ビーコン領域監視に必要なのは location のみ。
      // processing を残すと BGTaskSchedulerPermittedIdentifiers が必須になりアップロードが拒否される
      UIBackgroundModes: ["location"],
      NSFaceIDUsageDescription:
        "Face IDを使用してアカウントに安全にログインします。",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "アプリを閉じていてもオフィスのビーコンを検知し、自動で入退室を記録するために位置情報を利用します。",
      NSLocationWhenInUseUsageDescription:
        "オフィスのビーコンを検知して、自動で入退室を記録するために位置情報を利用します。",
      NSBluetoothAlwaysUsageDescription:
        "オフィスに設置されたビーコンを検知して、自動で入退室を記録するためにBluetoothを利用します。",
      NSPhotoLibraryUsageDescription:
        "プロフィール画像を設定するために写真ライブラリにアクセスします。",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/office-manager-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.toma0705.officemanager",
    // iBeacon の検知には位置情報（常に許可）と Bluetooth のスキャン（Android 12 以降）が必要
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "BLUETOOTH_SCAN",
      // テストモードの通知（Android 13 以降は許可が必要）
      ...(TEST_MODE ? ["POST_NOTIFICATIONS"] : []),
    ],
    // 常駐通知（フォアグラウンドサービス）は使わない。ライブラリが追加する宣言も取り除き、
    // Google Play Console での追加の申告が不要な状態にする
    blockedPermissions: [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
    ],
    versionCode: 4,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-updates",
    "expo-secure-store",
    "./plugins/withPodsDeploymentTarget",
    "./plugins/withSceneLifecycle",
    "./plugins/withAndroidBeaconManifest",
    "./plugins/withAndroidReleaseSigning",
    "./plugins/withAndroidGradleMemory",
    [
      "expo-image-picker",
      {
        photosPermission:
          "プロフィール画像を設定するために写真ライブラリにアクセスします。",
        // 写真ライブラリから選ぶだけなので、カメラとマイクは使わない。
        // 未指定だと英語の仮の文言が入り、App Review で却下される（5.1.1）
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "オフィスのビーコンを検知して、自動で入退室を記録するために位置情報を利用します。",
        locationAlwaysAndWhenInUsePermission:
          "アプリを閉じていてもオフィスのビーコンを検知し、自動で入退室を記録するために位置情報を利用します。",
        // iBeacon 領域監視は位置情報サービスの一部（常に許可 + location background mode が必要）
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
        },
        android: {
          // Google Play は 2026年8月31日以降、新規アプリに API 36 以上を求める
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
  ],
  extra: {
    // Release ビルドでは .env が JS バンドルに埋め込まれないため、
    // ネイティブの app.config 経由で API の接続先を渡す（値は .env のまま）
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    testMode: TEST_MODE,
    eas: {
      projectId: "98a48421-8173-486e-92b8-71d9569e2b77",
    },
  },
};

module.exports = config;
