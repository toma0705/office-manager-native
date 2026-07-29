const config = {
  name: "入退室管理",
  owner: "toma0705",
  slug: "office-manager-native",
  scheme: "officemanager",
  version: "2.0",
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
        "アプリを閉じていてもオフィスへの入退室を検知し、自動で入退室を記録するために位置情報を利用します。",
      NSLocationAlwaysUsageDescription:
        "アプリを閉じていてもオフィスへの入退室を検知し、自動で入退室を記録するために位置情報を利用します。",
      NSLocationWhenInUseUsageDescription:
        "オフィス付近への入退室を検知して、自動で入退室を記録するために位置情報を利用します。",
      NSPhotoLibraryUsageDescription:
        "プロフィール画像を設定するために写真ライブラリにアクセスします。",
      UIBackgroundModes: ["location", "fetch", "processing"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/office-manager-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.toma0705.officemanager",
    versionCode: 1,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "ACCESS_WIFI_STATE",
      "ACCESS_NETWORK_STATE",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-updates",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
        },
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "オフィス付近への入退室を検知して、自動で入退室を記録するために位置情報を利用します。",
        locationAlwaysAndWhenInUsePermission:
          "アプリを閉じていてもオフィスへの入退室を検知し、自動で入退室を記録するために位置情報を利用します。",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    "expo-font",
  ],
  extra: {
    eas: {
      projectId: "98a48421-8173-486e-92b8-71d9569e2b77",
    },
  },
};

module.exports = config;
