/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "入退室管理",
  owner: "toma0705",
  slug: "office-manager-native",
  version: "1.1.0",
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
    buildNumber: "1",
    icon: "./assets/office-manager-icon.png",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
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
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
    ],
    versionCode: 1,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-updates",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "オフィスのビーコンを検知して、自動で入退室を記録するために位置情報を利用します。",
        locationAlwaysAndWhenInUsePermission:
          "アプリを閉じていてもオフィスのビーコンを検知し、自動で入退室を記録するために位置情報を利用します。",
        // iBeacon 領域監視は位置情報サービスの一部（常に許可 + location background mode が必要）
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
        },
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "98a48421-8173-486e-92b8-71d9569e2b77",
    },
  },
};

module.exports = config;
