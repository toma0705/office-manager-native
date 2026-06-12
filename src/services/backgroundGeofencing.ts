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

const toRegion = (snapshot: BackgroundAttendanceSnapshot): LocationRegion => ({
  identifier: snapshot.officeCode,
  latitude: snapshot.latitude,
  longitude: snapshot.longitude,
  radius: snapshot.radiusMeters,
  notifyOnEnter: true,
  notifyOnExit: true,
});

const postAttendanceAction = async (
  snapshot: BackgroundAttendanceSnapshot,
  action: "enter" | "exit"
) => {
  const response = await fetch(
    withApiPath(`/users/${snapshot.userId}/${action}`),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${snapshot.token}`,
      },
    }
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
  }).catch(error => {
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
        if (
          data.eventType === GeofencingEventType.Enter &&
          !snapshot.entered
        ) {
          await postAttendanceAction(snapshot, "enter");
        } else if (
          data.eventType === GeofencingEventType.Exit &&
          snapshot.entered
        ) {
          await postAttendanceAction(snapshot, "exit");
        }
      } catch (taskError) {
        console.warn("Failed to handle geofencing event", taskError);
      }
    }
  );
}

export const syncBackgroundAttendanceSnapshot = async (
  token: string | null,
  user: UserSafe | null
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

  if (await Location.hasStartedGeofencingAsync(BACKGROUND_GEOFENCING_TASK)) {
    await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
      toRegion(snapshot),
    ]);
  }
};

export const stopBackgroundAttendanceMonitoring = async () => {
  if (await Location.hasStartedGeofencingAsync(BACKGROUND_GEOFENCING_TASK)) {
    await Location.stopGeofencingAsync(BACKGROUND_GEOFENCING_TASK);
  }
  await backgroundAttendanceStorage.remove();
};

export const ensureBackgroundAttendanceMonitoring = async (
  token: string,
  user: UserSafe
) => {
  const snapshot = createBackgroundAttendanceSnapshot(token, user);
  if (!snapshot) return { started: false, reason: "unsupported-office" as const };

  const taskManagerAvailable = await TaskManager.isAvailableAsync();
  if (!taskManagerAvailable) {
    return { started: false, reason: "task-manager-unavailable" as const };
  }

  const foreground = await Location.getForegroundPermissionsAsync();
  let foregroundStatus = foreground.status;
  if (foregroundStatus !== "granted" && foreground.canAskAgain) {
    const requestedForeground =
      await Location.requestForegroundPermissionsAsync();
    foregroundStatus = requestedForeground.status;
  }

  if (foregroundStatus !== "granted") {
    return { started: false, reason: "foreground-denied" as const };
  }

  const background = await Location.getBackgroundPermissionsAsync();
  let backgroundStatus = background.status;
  if (backgroundStatus !== "granted" && background.canAskAgain) {
    const requestedBackground =
      await Location.requestBackgroundPermissionsAsync();
    backgroundStatus = requestedBackground.status;
  }

  if (backgroundStatus !== "granted") {
    await backgroundAttendanceStorage.set(snapshot);
    return { started: false, reason: "background-denied" as const };
  }

  await backgroundAttendanceStorage.set(snapshot);
  await Location.startGeofencingAsync(BACKGROUND_GEOFENCING_TASK, [
    toRegion(snapshot),
  ]);

  return { started: true as const };
};
