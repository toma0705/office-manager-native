import type { UserSafe } from "@office-manager/api-client";
import * as Location from "expo-location";
import { GeofencingEventType } from "expo-location";
import type { LocationRegion } from "expo-location";
import * as TaskManager from "expo-task-manager";
import { API_BASE_URL, withApiPath } from "@/constants/config";
import {
  backgroundAttendanceStorage,
  createBackgroundAttendanceSnapshot,
  type BackgroundAttendanceSnapshot,
} from "@/storage/backgroundAttendanceStorage";

export const BACKGROUND_GEOFENCING_TASK = "office-manager-background-geofence";

type GeofencingTaskData = {
  eventType: GeofencingEventType;
  region: LocationRegion;
};

// 💡 状態に応じて半径を切り替える関数（ここでお好みの距離を調整できます）
const getDynamicRadius = (isEntered: boolean) => {
  // isEntered(入室中)なら退室を緩く(100m)、入室前なら入室を厳しく(20m)
  return isEntered ? 100 : 20;
};

// 💡 動的ジオフェンスの生成
const toRegion = (
  snapshot: BackgroundAttendanceSnapshot,
  isEntered: boolean,
): LocationRegion => ({
  identifier: snapshot.officeCode,
  latitude: snapshot.latitude,
  longitude: snapshot.longitude,
  radius: getDynamicRadius(isEntered), // 状態に合わせて半径が可変する！
  notifyOnEnter: !isEntered, // 入室前だけ「入室」を検知
  notifyOnExit: isEntered, // 入室中だけ「退室」を検知
});

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

  await backgroundAttendanceStorage.patch({ entered: action === "enter" });
};

if (!TaskManager.isTaskDefined(BACKGROUND_GEOFENCING_TASK)) {
  TaskManager.defineTask<GeofencingTaskData>(
    BACKGROUND_GEOFENCING_TASK,
    async ({ data, error }) => {
      if (error) {
        console.warn("Background geofencing task failed", error);
        return;
      }

      const snapshot = await backgroundAttendanceStorage.get();
      if (!snapshot || !data) return;

      try {
        if (data.eventType === GeofencingEventType.Enter && !snapshot.entered) {
          // 入室処理を実行
          await postAttendanceAction(snapshot, "enter");
          // 💡 成功したら「退室用（緩い）」のジオフェンスに張り替える
          await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
            toRegion(snapshot, true),
          ]);
        } else if (
          data.eventType === GeofencingEventType.Exit &&
          snapshot.entered
        ) {
          // 退室処理を実行
          await postAttendanceAction(snapshot, "exit");
          // 💡 成功したら「入室用（厳しい）」のジオフェンスに張り替える
          await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
            toRegion(snapshot, false),
          ]);
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
  if (!token || !user) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }

  const snapshot = createBackgroundAttendanceSnapshot(token, user);
  if (!snapshot) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }

  await backgroundAttendanceStorage.set(snapshot);

  // 💡 起動時・ログイン時に、現在の「入室状態」に合わせて適切な半径で登録する
  await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
    toRegion(snapshot, Boolean(user.entered)),
  ]);
};

export const stopBackgroundAttendanceMonitoring = async () => {
  if (await Location.hasStartedGeofencingAsync(BACKGROUND_GEOFENCING_TASK)) {
    await Location.stopGeofencingAsync(BACKGROUND_GEOFENCING_TASK);
  }
  await backgroundAttendanceStorage.remove();
};
