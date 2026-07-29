import type { UserSafe } from "@office-manager/api-client/dist/esm/index";
import * as Location from "expo-location";
import { GeofencingEventType } from "expo-location";
import type { LocationRegion } from "expo-location";
import * as TaskManager from "expo-task-manager";
import NetInfo from "@react-native-community/netinfo";
import * as BackgroundTask from "expo-background-task";
import { API_BASE_URL, withApiPath } from "@/constants/config";
import {
  backgroundAttendanceStorage,
  createBackgroundAttendanceSnapshot,
  type BackgroundAttendanceSnapshot,
} from "@/storage/backgroundAttendanceStorage";

export const BACKGROUND_GEOFENCING_TASK = "office-manager-background-geofence";
export const BACKGROUND_WIFI_CHECK_TASK = "office-manager-wifi-check";

const MIN_TRANSITION_INTERVAL_MS = 10_000;
const OFFICE_IP_PREFIX = "192.168.3.";

type GeofencingTaskData = {
  eventType: GeofencingEventType;
  region: LocationRegion;
};

const toRegion = (snapshot: BackgroundAttendanceSnapshot): LocationRegion => ({
  identifier: snapshot.officeCode,
  latitude: snapshot.latitude,
  longitude: snapshot.longitude,
  radius: snapshot.radiusMeters,
  notifyOnEnter: true,
  notifyOnExit: true,
});

// タイマー（定期チェック）を停止するヘルパー関数
const stopWifiCheckTimer = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_WIFI_CHECK_TASK,
    );
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_WIFI_CHECK_TASK);
      console.log("[BackgroundTask] Wi-Fiチェックタイマーを停止しました。");
    }
  } catch (error) {
    console.warn("Failed to stop wifi check timer", error);
  }
};

const postAttendanceAction = async (
  snapshot: BackgroundAttendanceSnapshot,
  action: "enter" | "exit",
) => {
  const response = await fetch(
    withApiPath(`/users/${snapshot.userId}/${action}`),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${snapshot.token}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to ${action} in background`);
  }

  await fetch(`${API_BASE_URL}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: snapshot.userName,
      status: action === "enter" ? "入室" : "退室",
      officeCode: snapshot.officeCode,
    }),
  }).catch((error) => {
    console.warn("Failed to notify background attendance", error);
  });

  await backgroundAttendanceStorage.patch({
    entered: action === "enter",
    lastTransitionAt: Date.now(),
  });
};

// デバッグ用のネットワーク状態確認関数
const debugPrintWifiState = async () => {
  const netState = await NetInfo.fetch();

  console.log("================ [Wi-Fi Debug Start] ================");
  console.log("Network Type:", netState.type);
  console.log("Is Connected:", netState.isConnected);
  console.log("Is Internet Reachable:", netState.isInternetReachable);
  console.log("Full NetInfo State Object:", JSON.stringify(netState, null, 2));

  if (netState.type === "wifi") {
    const details = netState.details as { ipAddress?: string; subnet?: string };
    console.log("IP Address:", details?.ipAddress);
    console.log("Subnet Mask:", details?.subnet);
  } else {
    console.log("⚠️ Wi-Fiに接続されていないか、認識されていません。");
  }
  console.log("================= [Wi-Fi Debug End] =================");
};

// ============================================================================
// 1. Wi-Fi (IP) 定期チェックのバックグラウンドタスク定義
// ============================================================================
if (!TaskManager.isTaskDefined(BACKGROUND_WIFI_CHECK_TASK)) {
  TaskManager.defineTask(BACKGROUND_WIFI_CHECK_TASK, async () => {
    try {
      console.log("[Background Task Executed]");
      await debugPrintWifiState();

      const snapshot = await backgroundAttendanceStorage.get();
      if (!snapshot || snapshot.entered) {
        await stopWifiCheckTimer();
        return;
      }

      const netState = await NetInfo.fetch();

      if (netState.type === "wifi" && netState.details) {
        const details = netState.details as { ipAddress?: string };
        const currentIP = details.ipAddress;

        // オフィスのルーターから割り当てられるIP帯（例: 192.168.3.X）に一致するか検証
        if (currentIP && currentIP.startsWith(OFFICE_IP_PREFIX)) {
          console.log(
            `[WiFi Check] IP(${currentIP})がオフィスのIP帯(${OFFICE_IP_PREFIX}*)と一致！自動入室を実行します。`,
          );
          await postAttendanceAction(snapshot, "enter");
          await stopWifiCheckTimer();
          return;
        }

        console.log(
          `[WiFi Check] 現在のIP(${currentIP ?? "不明"})はオフィスのWi-Fiと異なります。次回再度チェックします。`,
        );
      } else {
        console.log(
          `[WiFi Check] まだWi-Fi未接続（ネットワークタイプ: ${netState.type}）。次回再度チェックします。`,
        );
      }
    } catch (error) {
      console.warn("Background WiFi check task failed", error);
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
        console.warn("Background geofencing task failed", error);
        return;
      }

      console.log(`[Geofence Event Triggered: ${data.eventType}]`);
      await debugPrintWifiState();

      const snapshot = await backgroundAttendanceStorage.get();
      if (!snapshot || !data) return;

      try {
        const now = Date.now();
        if (
          snapshot.lastTransitionAt &&
          now - snapshot.lastTransitionAt < MIN_TRANSITION_INTERVAL_MS
        ) {
          return;
        }

        // 🔵 エリアに入った時（Enter）
        if (data.eventType === GeofencingEventType.Enter && !snapshot.entered) {
          console.log(
            `[Geofence Enter] エリア内に入りました。即時IPチェックを実行します。`,
          );

          // 1. その場で即時IPチェックを行う
          const netState = await NetInfo.fetch();
          if (netState.type === "wifi" && netState.details) {
            const details = netState.details as { ipAddress?: string };
            const currentIP = details.ipAddress;

            if (currentIP && currentIP.startsWith(OFFICE_IP_PREFIX)) {
              console.log(
                `[Geofence Enter Instant Check] IP(${currentIP})がオフィスのIP帯(${OFFICE_IP_PREFIX}*)と一致！即時自動入室を実行します。`,
              );
              await postAttendanceAction(snapshot, "enter");
              await stopWifiCheckTimer();
              return; // 入室完了のためタイマー起動はスキップ
            }
          }

          // 2. まだオフィスのWi-Fiに未接続の場合はバックグラウンド定期タスクを開始
          console.log(
            `[Geofence Enter] まだオフィスのWi-Fi未接続。定期Wi-Fiチェックタイマーを開始します。`,
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
            console.log(
              `[Geofence Exit] エリア外に出たため退室処理を実行します。`,
            );
            await postAttendanceAction(snapshot, "exit");
          } else {
            console.log(
              `[Geofence Exit] エリア外に出たため定期チェックタスクを停止します。`,
            );
          }
          await stopWifiCheckTimer();
        }
      } catch (taskError) {
        console.warn("Failed to handle geofencing event", taskError);
      }
    },
  );
}

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

  const currentSnapshot = await backgroundAttendanceStorage.get();
  if (
    currentSnapshot?.userId === snapshot.userId &&
    currentSnapshot.officeCode === snapshot.officeCode
  ) {
    snapshot.lastTransitionAt = currentSnapshot.lastTransitionAt;
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
