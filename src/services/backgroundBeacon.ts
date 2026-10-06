import type { UserSafe } from "@office-manager/api-client";
import * as Location from "expo-location";
import { API_BASE_URL, withApiPath } from "@/constants/config";
import { showLocalNotification } from "@/services/localNotification";
import { beaconLogStorage } from "@/storage/beaconLogStorage";
import { testModeStorage } from "@/storage/testModeStorage";
import {
  backgroundAttendanceStorage,
  createBackgroundAttendanceSnapshot,
  type BackgroundAttendanceSnapshot,
} from "@/storage/backgroundAttendanceStorage";
import {
  addRegionStateListener,
  isBeaconSupported,
  refreshState,
  startMonitoring,
  stopMonitoring,
  type BeaconRegionState,
} from "../../modules/office-beacon/src";

const BEACON_REGION_ID = "office-manager-beacon";
const LEGACY_GEOFENCING_TASK = "office-manager-background-geofence";

/** GPS ジオフェンス時代に登録されたタスクが端末に残っていれば解除する（移行用） */
const stopLegacyGeofencing = async () => {
  try {
    if (await Location.hasStartedGeofencingAsync(LEGACY_GEOFENCING_TASK)) {
      await Location.stopGeofencingAsync(LEGACY_GEOFENCING_TASK);
    }
  } catch (error) {
    console.warn("Failed to stop legacy geofencing", error);
  }
};

type AttendanceListener = (action: "enter" | "exit") => void;
const attendanceListeners = new Set<AttendanceListener>();

/** 自動入退室が記録されたときに呼ばれる（画面側のデータ再取得用） */
export const onBackgroundAttendanceChanged = (listener: AttendanceListener) => {
  attendanceListeners.add(listener);
  return () => {
    attendanceListeners.delete(listener);
  };
};

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

  const status = action === "enter" ? "入室" : "退室";
  if (await testModeStorage.get()) {
    // テストモード: Discord には送らず、端末のローカル通知で代用する
    await showLocalNotification(
      `【テスト】${status}を検知`,
      `${snapshot.userName} さんが ${status} しました（Discordには送信していません）`
    );
  } else {
    await fetch(`${API_BASE_URL}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: snapshot.userName,
        status,
        officeCode: snapshot.officeCode,
      }),
    }).catch(error => {
      console.warn("Failed to notify background attendance", error);
    });
  }

  await backgroundAttendanceStorage.patch({ entered: action === "enter" });
  attendanceListeners.forEach(listener => listener(action));
};

let processing: Promise<void> = Promise.resolve();

/** ビーコン状態を入退室に反映する。既に同じ状態なら何もしない。 */
const applyBeaconState = async (state: BeaconRegionState) => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (!snapshot) {
    void beaconLogStorage.append(`${state}: 無視(ログイン情報なし)`);
    return;
  }

  const action = state === "inside" ? "enter" : "exit";
  if ((action === "enter") === snapshot.entered) {
    void beaconLogStorage.append(
      `${state}: 無視(すでに${snapshot.entered ? "入室" : "退室"}済み)`
    );
    return;
  }

  try {
    await postAttendanceAction(snapshot, action);
    void beaconLogStorage.append(`${state}: ${action === "enter" ? "入室" : "退室"}を記録`);
  } catch (error) {
    console.warn("Failed to handle beacon event", error);
    void beaconLogStorage.append(`${state}: 記録に失敗 ${String(error).slice(0, 80)}`);
  }
};

const enqueue = (state: BeaconRegionState) => {
  processing = processing.then(() => applyBeaconState(state));
  return processing;
};

// モジュール読み込み時（バックグラウンド起動時を含む）にリスナーを登録する
addRegionStateListener(event => {
  void beaconLogStorage.append(`検知: ${event.state} (${event.source})`);
  void enqueue(event.state);
});

// 終了状態から OS に起こされた場合、監視は OS 側に残っている。
// 現在の状態を問い合わせて取りこぼしたイベントを補完する。
void backgroundAttendanceStorage.get().then(snapshot => {
  if (snapshot) {
    void beaconLogStorage.append("起動: 状態を問い合わせ");
    void refreshState();
  }
});

export const syncBackgroundAttendanceSnapshot = async (
  token: string | null,
  user: UserSafe | null
) => {
  const snapshot = token && user ? createBackgroundAttendanceSnapshot(token, user) : null;
  if (!snapshot) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }
  await backgroundAttendanceStorage.set(snapshot);
};

export const stopBackgroundAttendanceMonitoring = async () => {
  await stopMonitoring();
  await backgroundAttendanceStorage.remove();
};

export const ensureBackgroundAttendanceMonitoring = async (
  token: string,
  user: UserSafe
) => {
  const snapshot = createBackgroundAttendanceSnapshot(token, user);
  if (!snapshot) return { started: false, reason: "unsupported-office" as const };

  if (!isBeaconSupported) {
    return { started: false, reason: "beacon-unavailable" as const };
  }

  // iOS のビーコン領域監視には位置情報の「常に許可」が必要
  const foreground = await Location.getForegroundPermissionsAsync();
  let foregroundStatus = foreground.status;
  if (foregroundStatus !== "granted" && foreground.canAskAgain) {
    foregroundStatus = (await Location.requestForegroundPermissionsAsync())
      .status;
  }
  if (foregroundStatus !== "granted") {
    return { started: false, reason: "foreground-denied" as const };
  }

  const background = await Location.getBackgroundPermissionsAsync();
  let backgroundStatus = background.status;
  if (backgroundStatus !== "granted" && background.canAskAgain) {
    backgroundStatus = (await Location.requestBackgroundPermissionsAsync())
      .status;
  }

  await backgroundAttendanceStorage.set(snapshot);

  if (backgroundStatus !== "granted") {
    void beaconLogStorage.append(`監視を開始できません(位置情報: ${backgroundStatus})`);
    return { started: false, reason: "background-denied" as const };
  }

  await stopLegacyGeofencing();

  const started = await startMonitoring({
    ...snapshot.beacon,
    identifier: BEACON_REGION_ID,
  });
  if (!started) return { started: false, reason: "beacon-unavailable" as const };

  void beaconLogStorage.append("監視を開始");
  return { started: true as const };
};
