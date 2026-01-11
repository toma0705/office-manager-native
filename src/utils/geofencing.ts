import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { sendEnterNotification, sendExitNotification } from "./notifications";

export const GEOFENCING_TASK = "GEOFENCING_TASK";

// タスクの定義（グローバルスコープで実行される必要がある）
TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Geofencing task error:", error);
    return;
  }
  if (data) {
    const { eventType } = data as { eventType: Location.GeofencingEventType };

    if (eventType === Location.GeofencingEventType.Enter) {
      console.log("Geofence Enter detected");
      await sendEnterNotification();
    } else if (eventType === Location.GeofencingEventType.Exit) {
      console.log("Geofence Exit detected");
      await sendExitNotification();
    }
  }
});

export async function requestLocationPermissions() {
  // フォアグラウンド権限
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    console.log("Foreground location permission denied");
    return false;
  }

  // バックグラウンド権限
  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    console.log("Background location permission denied");
    return false;
  }

  return true;
}

export async function startGeofencing(
  latitude: number,
  longitude: number,
  radius: number = 100
) {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error("Location permissions are required for geofencing.");
  }

  await Location.startGeofencingAsync(GEOFENCING_TASK, [
    {
      identifier: "office-location",
      latitude,
      longitude,
      radius,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
  console.log("Geofencing started");
}

export async function stopGeofencing() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCING_TASK);
    console.log("Geofencing stopped");
  }
}
