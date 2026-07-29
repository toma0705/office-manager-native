import NetInfo from "@react-native-community/netinfo";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import type { LocationRegion } from "expo-location";
import { API_BASE_URL, withApiPath } from "@/constants/config";
import {
  backgroundAttendanceStorage,
  type BackgroundAttendanceSnapshot,
} from "@/storage/backgroundAttendanceStorage";

export const BACKGROUND_WIFI_CHECK_TASK = "office-manager-wifi-check";
export const OFFICE_IP_PREFIX = "192.168.3.";

export const toRegion = (
  snapshot: BackgroundAttendanceSnapshot,
): LocationRegion => ({
  identifier: snapshot.officeCode,
  latitude: snapshot.latitude,
  longitude: snapshot.longitude,
  radius: snapshot.radiusMeters,
  notifyOnEnter: true,
  notifyOnExit: true,
});

// タイマー（定期チェック）を停止するヘルパー関数
export const stopWifiCheckTimer = async () => {
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

// 出退勤送信処理（※デバッグ中のため関数内をコメントアウト）
export const postAttendanceAction = async (
  snapshot: BackgroundAttendanceSnapshot,
  action: "enter" | "exit",
) => {
  /* 🛠 デバッグ中のためコメントアウト
  const response = await fetch(
    withApiPath(`/users/${snapshot.userId}/${action}`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${snapshot.token}` },
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
  */
};

// オフィスのWi-Fi (IP) に接続されているかチェックする共通関数
export const checkOfficeWifiStatus = async (): Promise<{
  isOfficeWifi: boolean;
  currentIP?: string;
  netType: string;
}> => {
  const netState = await NetInfo.fetch();
  let currentIP: string | undefined;

  if (netState.type === "wifi" && netState.details) {
    const details = netState.details as { ipAddress?: string };
    currentIP = details.ipAddress;
  }

  const isOfficeWifi =
    netState.type === "wifi" &&
    !!currentIP &&
    currentIP.startsWith(OFFICE_IP_PREFIX);

  return { isOfficeWifi, currentIP, netType: netState.type };
};

// デバッグ用のネットワーク状態確認関数
export const debugPrintWifiState = async () => {
  const netState = await NetInfo.fetch();
  console.log("================ [Wi-Fi Debug Start] ================");
  console.log("Network Type:", netState.type);
  console.log("Full NetInfo State Object:", JSON.stringify(netState, null, 2));
  console.log("================= [Wi-Fi Debug End] =================");
};
