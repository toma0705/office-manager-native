import type { UserSafe } from "@office-manager/api-client";
import * as Location from "expo-location";
import { API_BASE_URL, withApiPath } from "@/constants/config";
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
  await fetch(`${API_BASE_URL}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${snapshot.token}`,
    },
    body: JSON.stringify({
      user: snapshot.userName,
      status,
      officeCode: snapshot.officeCode,
    }),
  }).catch(error => {
    console.warn("Failed to notify background attendance", error);
  });

  await backgroundAttendanceStorage.patch({ entered: action === "enter" });
  attendanceListeners.forEach(listener => listener(action));
};

/**
 * サーバー上の在室状態を取得する。夜間の強制退室などで端末の記録とずれるため、
 * 判定はサーバーを正とする。取得できなければ null。
 */
const fetchServerEntered = async (
  snapshot: BackgroundAttendanceSnapshot
): Promise<boolean | null> => {
  try {
    const response = await fetch(withApiPath("/users/me"), {
      headers: { Authorization: `Bearer ${snapshot.token}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.user?.entered === "boolean" ? body.user.entered : null;
  } catch {
    return null;
  }
};

let processing: Promise<void> = Promise.resolve();

/** ビーコン状態を入退室に反映する。既に同じ状態なら何もしない。 */
const applyBeaconState = async (state: BeaconRegionState) => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (!snapshot) return;

  const serverEntered = await fetchServerEntered(snapshot);
  if (serverEntered !== null && serverEntered !== snapshot.entered) {
    await backgroundAttendanceStorage.patch({ entered: serverEntered });
    snapshot.entered = serverEntered;
  }

  const action = state === "inside" ? "enter" : "exit";
  if ((action === "enter") === snapshot.entered) return;

  try {
    await postAttendanceAction(snapshot, action);
  } catch (error) {
    console.warn("Failed to handle beacon event", error);
  }
};

const enqueue = (state: BeaconRegionState) => {
  processing = processing.then(() => applyBeaconState(state));
  return processing;
};

// モジュール読み込み時（バックグラウンド起動時を含む）にリスナーを登録する
addRegionStateListener(event => {
  void enqueue(event.state);
});

// 終了状態から OS に起こされた場合、監視は OS 側に残っている。
// 現在の状態を問い合わせて取りこぼしたイベントを補完する。
void backgroundAttendanceStorage.get().then(snapshot => {
  if (snapshot) void refreshState();
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
    return { started: false, reason: "background-denied" as const };
  }

  const started = await startMonitoring({
    ...snapshot.beacon,
    identifier: BEACON_REGION_ID,
  });
  if (!started) return { started: false, reason: "beacon-unavailable" as const };

  return { started: true as const };
};
