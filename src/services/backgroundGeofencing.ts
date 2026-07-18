import type { UserSafe } from "@office-manager/api-client/dist/esm/index";
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
const MIN_TRANSITION_INTERVAL_MS = 10_000;
const ENTER_PADDING_METERS = 5;
const EXIT_PADDING_METERS = 10;

type GeofencingTaskData = {
  eventType: GeofencingEventType;
  region: LocationRegion;
};

const getDynamicRadius = (isEntered: boolean, officeRadiusMeters: number) => {
  return (
    officeRadiusMeters +
    (isEntered ? EXIT_PADDING_METERS : ENTER_PADDING_METERS)
  );
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

  await backgroundAttendanceStorage.patch({
    entered: action === "enter",
    lastTransitionAt: Date.now(),
  });
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
        const now = Date.now();
        if (
          snapshot.lastTransitionAt &&
          now - snapshot.lastTransitionAt < MIN_TRANSITION_INTERVAL_MS
        ) {
          return;
        }

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

  // 状態が一致していても、監視自体は必ず開始・更新する。
  // Discord 通知は task の enter / exit 遷移時だけ発火するため、ここでは送らない。
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
