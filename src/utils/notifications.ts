import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const NOTIFICATION_CATEGORIES = {
  GEOFENCE_ENTER: "GEOFENCE_ENTER",
  GEOFENCE_EXIT: "GEOFENCE_EXIT",
};

export const NOTIFICATION_ACTIONS = {
  ENTER: "ENTER_ACTION",
  EXIT: "EXIT_ACTION",
};

export async function setupNotifications() {
  // 通知の表示設定
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Android用のチャンネル設定
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  // 通知カテゴリ（アクションボタン）の設定
  await Notifications.setNotificationCategoryAsync(
    NOTIFICATION_CATEGORIES.GEOFENCE_ENTER,
    [
      {
        identifier: NOTIFICATION_ACTIONS.ENTER,
        buttonTitle: "入室する",
        options: {
          opensAppToForeground: false, // バックグラウンドで処理
        },
      },
    ]
  );

  await Notifications.setNotificationCategoryAsync(
    NOTIFICATION_CATEGORIES.GEOFENCE_EXIT,
    [
      {
        identifier: NOTIFICATION_ACTIONS.EXIT,
        buttonTitle: "退室する",
        options: {
          opensAppToForeground: false, // バックグラウンドで処理
        },
      },
    ]
  );
}

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === "granted";
}

export async function sendEnterNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "オフィスに到着しました",
      body: "入室処理を行いますか？",
      categoryIdentifier: NOTIFICATION_CATEGORIES.GEOFENCE_ENTER,
      data: { type: "enter" },
    },
    trigger: null, // 即時発火
  });
}

export async function sendExitNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "オフィスから離れました",
      body: "退室処理を行いますか？",
      categoryIdentifier: NOTIFICATION_CATEGORIES.GEOFENCE_EXIT,
      data: { type: "exit" },
    },
    trigger: null, // 即時発火
  });
}
