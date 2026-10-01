import type { UserSafe } from "@office-manager/api-client";
import * as Location from "expo-location";
import { API_BASE_URL, withApiPath } from "@/constants/config";
import { MIN_TRANSITION_INTERVAL_MS } from "@/constants/beacon";
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

  await backgroundAttendanceStorage.patch({
    entered: action === "enter",
    lastTransitionAt: Date.now(),
    pendingState: null,
  });
  attendanceListeners.forEach(listener => listener(action));
};

let processing: Promise<void> = Promise.resolve();

/**
 * ビーコン状態を入退室に反映する。
 * - 既に同じ状態なら何もしない
 * - 直前の入退室から MIN_TRANSITION_INTERVAL_MS 以内なら保留（チャタリング防止）
 * - source=refresh の "outside" は問い合わせ結果にすぎないため退室扱いしない
 *   （手動入室した人を、ビーコン圏外でのアプリ起動で勝手に退室させないため）
 */
const applyBeaconState = async (
  state: BeaconRegionState,
  source: "event" | "refresh"
) => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (!snapshot) return;

  const action = state === "inside" ? "enter" : "exit";
  if ((action === "enter") === snapshot.entered) {
    if (snapshot.pendingState) {
      await backgroundAttendanceStorage.patch({ pendingState: null });
    }
    return;
  }
  if (source === "refresh" && action === "exit") return;

  if (Date.now() - snapshot.lastTransitionAt < MIN_TRANSITION_INTERVAL_MS) {
    await backgroundAttendanceStorage.patch({ pendingState: state });
    return;
  }

  try {
    await postAttendanceAction(snapshot, action);
  } catch (error) {
    console.warn("Failed to handle beacon event", error);
  }
};

const enqueue = (state: BeaconRegionState, source: "event" | "refresh") => {
  processing = processing.then(() => applyBeaconState(state, source));
  return processing;
};

/** クールダウンで保留されていた状態を、時間が経ったあとに再評価する */
export const reconcilePendingAttendance = async () => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (!snapshot?.pendingState) return;
  await enqueue(snapshot.pendingState, "event");
};

// モジュール読み込み時（バックグラウンド起動時を含む）にリスナーを登録する
addRegionStateListener(event => {
  void enqueue(event.state, event.source);
});

// 終了状態から OS に起こされた場合、監視は OS 側に残っている。
// 現在の状態を問い合わせて取りこぼしたイベントを補完する。
void backgroundAttendanceStorage.get().then(snapshot => {
  if (snapshot) void refreshState();
});

const mergeSnapshot = async (snapshot: BackgroundAttendanceSnapshot) => {
  const current = await backgroundAttendanceStorage.get();
  await backgroundAttendanceStorage.set({
    ...snapshot,
    lastTransitionAt: current?.lastTransitionAt ?? 0,
    pendingState: current?.pendingState ?? null,
  });
};

export const syncBackgroundAttendanceSnapshot = async (
  token: string | null,
  user: UserSafe | null
) => {
  const snapshot = token && user ? createBackgroundAttendanceSnapshot(token, user) : null;
  if (!snapshot) {
    await stopBackgroundAttendanceMonitoring();
    return;
  }
  await mergeSnapshot(snapshot);
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

  await mergeSnapshot(snapshot);

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
