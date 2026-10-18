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

// 専用トークンは1日に1回まで発行し直す（期限を延ばすため、アプリを開いたときに更新する）
const ATTENDANCE_TOKEN_REFRESH_MS = 24 * 60 * 60 * 1000;

/** バックグラウンドの入退室に使うトークン。専用トークンがなければログイン用を使う */
const backgroundToken = (snapshot: BackgroundAttendanceSnapshot) =>
  snapshot.attendanceToken ?? snapshot.token;

/**
 * 自動入退室専用トークン(1年間有効)を発行してもらう。ログイン用トークンは7日で失効し、
 * アプリをほとんど開かない使い方ではバックグラウンドの入退室が失敗するため。
 */
const issueAttendanceToken = async (loginToken: string): Promise<string | null> => {
  try {
    const response = await fetch(withApiPath("/users/attendance-token"), {
      method: "POST",
      headers: { Authorization: `Bearer ${loginToken}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.token === "string" ? body.token : null;
  } catch (error) {
    console.warn("Failed to issue attendance token", error);
    return null;
  }
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
        Authorization: `Bearer ${backgroundToken(snapshot)}`,
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
    headers: { "Content-Type": "application/json" },
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
    const response = await fetch(withApiPath("/users/attendance-status"), {
      headers: { Authorization: `Bearer ${backgroundToken(snapshot)}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.entered === "boolean" ? body.entered : null;
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

  // 同じユーザーの専用トークンが新しければ使い回し、古ければ発行し直す。
  // 発行に失敗したとき(通信できないなど)は、手元の専用トークンを使い続ける。
  const current = await backgroundAttendanceStorage.get();
  const kept =
    current?.userId === snapshot.userId && current.attendanceToken
      ? {
          attendanceToken: current.attendanceToken,
          attendanceTokenIssuedAt: current.attendanceTokenIssuedAt,
        }
      : {};
  const isFresh =
    kept.attendanceToken &&
    Date.now() - (kept.attendanceTokenIssuedAt ?? 0) < ATTENDANCE_TOKEN_REFRESH_MS;
  const issued = isFresh ? null : await issueAttendanceToken(snapshot.token);

  await backgroundAttendanceStorage.set({
    ...snapshot,
    ...kept,
    ...(issued ? { attendanceToken: issued, attendanceTokenIssuedAt: Date.now() } : {}),
  });
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

  await syncBackgroundAttendanceSnapshot(token, user);

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
