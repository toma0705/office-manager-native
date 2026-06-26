import type { UserSafe } from "@office-manager/api-client/dist/esm/index";
import * as Location from "expo-location";
import { GeofencingEventType } from "expo-location";
import type { LocationRegion } from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDistanceToOffice } from "@/utils/location";
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

const getDynamicRadius = (isEntered: boolean, officeRadiusMeters: number) => {
  return isEntered ? officeRadiusMeters + 20 : officeRadiusMeters;
};

const toRegion = (
  snapshot: BackgroundAttendanceSnapshot,
  isEntered: boolean,
): LocationRegion => ({
  identifier: snapshot.officeCode,
  latitude: snapshot.latitude,
  longitude: snapshot.longitude,
  radius: getDynamicRadius(isEntered, snapshot.radiusMeters),
  notifyOnEnter: !isEntered,
  notifyOnExit: isEntered,
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
          await postAttendanceAction(snapshot, "enter");
          await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
            toRegion(snapshot, true),
          ]);
        } else if (
          data.eventType === GeofencingEventType.Exit &&
          snapshot.entered
        ) {
          await postAttendanceAction(snapshot, "exit");
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
  if (!token || !user || !user.office) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }

  // 1. 既存の utils/location.ts を使って距離を計算
  const distance = await getDistanceToOffice(
    user.office.latitude,
    user.office.longitude,
  );

  // 判定範囲を取得
  const currentRadius = getDynamicRadius(
    Boolean(user.entered),
    user.office.radiusMeters,
  );
  const shouldBeEntered = distance <= currentRadius;

  // 2. 💡 ガード：サーバーの状態と現在の判定が一致していればスキップ
  if (shouldBeEntered === Boolean(user.entered)) {
    console.log("【同期】状態に変化なし。同期をスキップします。");
    // ここでreturnしてAPI呼び出しを止める！
    return;
  }

  // 3. 状態が変わっている場合のみ、以降の同期処理を実行
  const snapshot = createBackgroundAttendanceSnapshot(token, user);
  if (!snapshot) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }

  await backgroundAttendanceStorage.set(snapshot);

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
