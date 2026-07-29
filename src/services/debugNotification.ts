import * as Notifications from "expo-notifications";

// 通知の表示制御（フォアグラウンド・バックグラウンド問わず通知音とアラートを出す）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // バナーを表示する
    shouldShowList: true, // 通知センターに表示する
    shouldPlaySound: true, // 音を鳴らす
    shouldSetBadge: false, // バッジを変更しない
  }),
});

// 🔔 ローカルデバッグ通知送信ヘルパー関数
export const sendDebugNotification = async (title: string, body: string) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `[Debug] ${title}`,
        body: body,
        sound: true,
      },
      trigger: null, // 即時配信
    });
  } catch (e) {
    console.warn("Failed to send debug notification", e);
  }
};
