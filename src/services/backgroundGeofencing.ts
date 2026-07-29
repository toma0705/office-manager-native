import type { UserSafe } from "@office-manager/api-client/dist/esm/index";
import * as Location from "expo-location";
import { GeofencingEventType, type LocationRegion } from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import {
  backgroundAttendanceStorage,
  createBackgroundAttendanceSnapshot,
} from "@/storage/backgroundAttendanceStorage";
import { sendDebugNotification } from "./debugNotification";
import {
  BACKGROUND_WIFI_CHECK_TASK,
  toRegion,
  stopWifiCheckTimer,
  postAttendanceAction,
  checkOfficeWifiStatus,
  debugPrintWifiState,
} from "./geofenceHelpers";

export const BACKGROUND_GEOFENCING_TASK = "office-manager-background-geofence";

type GeofencingTaskData = {
  eventType: GeofencingEventType;
  region: LocationRegion;
};

// ============================================================================
// 1. Wi-Fi (IP) 定期チェックのバックグラウンドタスク定義
// ============================================================================
if (!TaskManager.isTaskDefined(BACKGROUND_WIFI_CHECK_TASK)) {
  TaskManager.defineTask(BACKGROUND_WIFI_CHECK_TASK, async () => {
    try {
      await debugPrintWifiState();
      const snapshot = await backgroundAttendanceStorage.get();
      if (!snapshot || snapshot.entered) {
        await stopWifiCheckTimer();
        return;
      }

      const { isOfficeWifi, currentIP, netType } =
        await checkOfficeWifiStatus();

      if (isOfficeWifi) {
        await sendDebugNotification(
          "自動入室成功（定期）",
          `IP: ${currentIP} に接続されたため入室処理を実行しました。`,
        );
        await postAttendanceAction(snapshot, "enter");
        await stopWifiCheckTimer();
      } else {
        await sendDebugNotification(
          "定期IPチェック保留",
          `IP: ${currentIP ?? "未接続"} (Type: ${netType})`,
        );
      }
    } catch (error) {
      console.warn("Background WiFi check task failed", error);
      await sendDebugNotification(
        "タイマーエラー",
        "定期チェックでエラーが発生しました。",
      );
    }
  });
}

// ============================================================================
// 2. GPS（ジオフェンス）のバックグラウンドタスク定義
// ============================================================================
if (!TaskManager.isTaskDefined(BACKGROUND_GEOFENCING_TASK)) {
  TaskManager.defineTask<GeofencingTaskData>(
    BACKGROUND_GEOFENCING_TASK,
    async ({ data, error }) => {
      if (error) {
        await sendDebugNotification(
          "ジオフェンスエラー",
          "Geofencing task error",
        );
        return;
      }

      await debugPrintWifiState();
      const snapshot = await backgroundAttendanceStorage.get();
      if (!snapshot || !data) return;

      try {
        // 🔵 エリアに入った時（Enter）
        if (data.eventType === GeofencingEventType.Enter && !snapshot.entered) {
          await sendDebugNotification(
            "ジオフェンスEnter",
            "エリア侵入を検知。IP確認中...",
          );
          const { isOfficeWifi, currentIP } = await checkOfficeWifiStatus();

          if (isOfficeWifi) {
            await sendDebugNotification(
              "自動入室成功（即時）",
              `IP: ${currentIP} 一致！自動入室を実行しました。`,
            );
            await postAttendanceAction(snapshot, "enter");
            await stopWifiCheckTimer();
            return;
          }

          // 未接続の場合は定期タイマーを開始
          await sendDebugNotification(
            "Wi-Fi未接続",
            "IP不一致のため、定期Wi-Fiチェックタイマーを開始します。",
          );
          const isRegistered = await TaskManager.isTaskRegisteredAsync(
            BACKGROUND_WIFI_CHECK_TASK,
          );
          if (!isRegistered) {
            await BackgroundTask.registerTaskAsync(BACKGROUND_WIFI_CHECK_TASK, {
              minimumInterval: 10,
            });
          }
        }
        // 🔴 エリアから出た時（Exit）
        else if (data.eventType === GeofencingEventType.Exit) {
          if (snapshot.entered) {
            const { isOfficeWifi, currentIP } = await checkOfficeWifiStatus();

            // まだオフィスの Wi-Fi に繋がっている場合は「GPSの誤検知」とみなす
            if (isOfficeWifi) {
              await sendDebugNotification(
                "退室スキップ",
                "GPSエリア外ですがWi-Fi接続中のため滞在を維持します。",
              );
              return;
            }

            await sendDebugNotification(
              "自動退室",
              `Wi-Fi切断のため退室しました。(IP: ${currentIP ?? "なし"})`,
            );
            await postAttendanceAction(snapshot, "exit");
          }
          await stopWifiCheckTimer();
        }
      } catch (taskError) {
        console.warn("Failed to handle geofencing event", taskError);
        await sendDebugNotification(
          "ジオフェンス例外",
          "イベント処理中に例外が発生しました。",
        );
      }
    },
  );
}

// ============================================================================
// モニタリングの同期・停止関数
// ============================================================================
export const syncBackgroundAttendanceSnapshot = async (
  token: string | null,
  user: UserSafe | null,
) => {
  await stopWifiCheckTimer();

  if (!token || !user || !user.office) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }

  const snapshot = createBackgroundAttendanceSnapshot(token, user);
  if (!snapshot) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }

  await backgroundAttendanceStorage.set(snapshot);
  await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
    toRegion(snapshot),
  ]);
};

export const stopBackgroundAttendanceMonitoring = async () => {
  if (await Location.hasStartedGeofencingAsync(BACKGROUND_GEOFENCING_TASK)) {
    await Location.stopGeofencingAsync(BACKGROUND_GEOFENCING_TASK);
  }
  await stopWifiCheckTimer();
  await backgroundAttendanceStorage.remove();
};
