/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "入退室管理",
  owner: "toma0705",
  slug: "office-manager-native",
  version: "1.0.0",
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
    versionCode: 1,
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
