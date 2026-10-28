import type { UserSafe } from "@office-manager/api-client";
import * as Location from "expo-location";
import { Alert, AppState, PermissionsAndroid, Platform } from "react-native";
import { API_BASE_URL, TEST_MODE, withApiPath } from "@/constants/config";
import {
  backgroundAttendanceStorage,
  createBackgroundAttendanceSnapshot,
  type BackgroundAttendanceSnapshot,
} from "@/storage/backgroundAttendanceStorage";
import {
  addAttendanceChangedListener,
  addRegionStateListener,
  handlesAttendanceNatively,
  isBeaconSupported,
  refreshState,
  setAttendanceConfig,
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

const postAttendance = async (
  snapshot: BackgroundAttendanceSnapshot,
  path: "enter" | "leave"
) => {
  const response = await fetch(withApiPath(`/users/${snapshot.userId}/${path}`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${snapshot.token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to ${path} in background`);
  }
};

const recordEnter = async (snapshot: BackgroundAttendanceSnapshot) => {
  await postAttendance(snapshot, "enter");

  // テストモードでは Discord に通知しない
  if (!TEST_MODE) {
    await fetch(`${API_BASE_URL}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${snapshot.token}`,
      },
      body: JSON.stringify({
        user: snapshot.userName,
        status: "入室",
        officeCode: snapshot.officeCode,
      }),
    }).catch(error => {
      console.warn("Failed to notify background attendance", error);
    });
  }

  await backgroundAttendanceStorage.patch({ entered: true });
  attendanceListeners.forEach(listener => listener("enter"));
};

type ServerAttendance = { entered: boolean; exitPending: boolean };

/**
 * サーバー上の在室状態を取得する。Web での手動の入退室などで端末の記録とずれるため、
 * 判定はサーバーを正とする。取得できなければ null。
 */
const fetchServerAttendance = async (
  snapshot: BackgroundAttendanceSnapshot
): Promise<ServerAttendance | null> => {
  try {
    const response = await fetch(withApiPath("/users/me"), {
      headers: { Authorization: `Bearer ${snapshot.token}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (typeof body?.user?.entered !== "boolean") return null;
    return {
      entered: body.user.entered,
      exitPending: body.user.entered && body.user.exitPendingSince != null,
    };
  } catch {
    return null;
  }
};

let processing: Promise<void> = Promise.resolve();

/**
 * ビーコン状態を入退室に反映する。既に同じ状態なら何もしない。
 * 圏外になってもすぐには退室にせず、サーバーで保留にする（猶予の間に戻らなければ
 * サーバーが退室を確定して Discord に通知する）。保留中に圏内に戻れば取り消す。
 */
const applyBeaconState = async (state: BeaconRegionState) => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (!snapshot) return;

  const server = await fetchServerAttendance(snapshot);
  if (server && server.entered !== snapshot.entered) {
    await backgroundAttendanceStorage.patch({ entered: server.entered });
    snapshot.entered = server.entered;
  }
  const exitPending = server?.exitPending ?? false;

  try {
    if (state === "inside") {
      if (!snapshot.entered) {
        await recordEnter(snapshot);
      } else if (exitPending) {
        // 猶予の間に戻ってきたので保留を取り消す（Discord には通知しない）
        await postAttendance(snapshot, "enter");
      }
    } else if (snapshot.entered && !exitPending) {
      await postAttendance(snapshot, "leave");
    }
  } catch (error) {
    console.warn("Failed to handle beacon event", error);
  }
};

const enqueue = (state: BeaconRegionState) => {
  processing = processing.then(() => applyBeaconState(state));
  return processing;
};

// モジュール読み込み時（バックグラウンド起動時を含む）にリスナーを登録する
if (handlesAttendanceNatively) {
  // Android は検知後の記録までネイティブ側で行うので、結果だけ受け取る
  addAttendanceChangedListener(action => {
    void backgroundAttendanceStorage
      .patch({ entered: action === "enter" })
      .then(() => attendanceListeners.forEach(listener => listener(action)));
  });
} else {
  addRegionStateListener(event => {
    void enqueue(event.state);
  });
}

/** ビーコンの現在の状態を問い合わせ、サーバーの在室状態とずれていれば直す */
const refreshIfMonitoring = async () => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (snapshot) await refreshState();
};

// 終了状態から OS に起こされた場合、監視は OS 側に残っている。
// 現在の状態を問い合わせて取りこぼしたイベントを補完する。
void refreshIfMonitoring();

// ビーコンの状態が変わらないと記録されないため、Web で手動で入退室を変えると
// 次の出入りまでずれたままになる。アプリが前面に戻ったときにも確かめ直す。
AppState.addEventListener("change", state => {
  if (state === "active") void refreshIfMonitoring();
});

/** Android のネイティブ側に入退室 API の呼び出しに必要な情報を渡す */
const saveSnapshot = async (snapshot: BackgroundAttendanceSnapshot) => {
  await backgroundAttendanceStorage.set(snapshot);
  if (handlesAttendanceNatively) {
    await setAttendanceConfig({
      apiBaseUrl: API_BASE_URL,
      token: snapshot.token,
      userId: snapshot.userId,
      userName: snapshot.userName,
      officeCode: snapshot.officeCode,
      testMode: TEST_MODE,
    });
  }
};

const confirmAsync = (title: string, message: string) =>
  new Promise<boolean>(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: "許可しない", style: "cancel", onPress: () => resolve(false) },
        { text: "続ける", onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });

/**
 * Google Play のポリシーにより、バックグラウンドの位置情報を求める前に
 * 用途をアプリ内で説明して同意を得る必要がある。
 */
const confirmBackgroundLocationDisclosure = async () => {
  if (Platform.OS !== "android") return true;
  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status === "granted") return true;
  return confirmAsync(
    "位置情報の利用について",
    "このアプリは、オフィスへの入退室を自動で記録するために、アプリを閉じているときや使用していないときも、位置情報と Bluetooth を使ってオフィスのビーコンを検知します。\n\n次の画面で位置情報を「常に許可」に設定してください。"
  );
};

/** Android 12 以降は Bluetooth のスキャンに「付近のデバイス」の許可が必要 */
const requestBluetoothScanPermission = async () => {
  if (Platform.OS !== "android" || Platform.Version < 31) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

/** テストモードの通知（Android 13 以降は許可が必要）。許可がなくても監視は続ける */
const requestTestNotificationPermission = async () => {
  if (!TEST_MODE || Platform.OS !== "android" || Platform.Version < 33) return;
  await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
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
  await saveSnapshot(snapshot);
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

  if (!(await confirmBackgroundLocationDisclosure())) {
    return { started: false, reason: "disclosure-declined" as const };
  }

  // ビーコンの領域監視には位置情報の「常に許可」が必要
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

  await saveSnapshot(snapshot);

  if (backgroundStatus !== "granted") {
    return { started: false, reason: "background-denied" as const };
  }

  if (!(await requestBluetoothScanPermission())) {
    return { started: false, reason: "bluetooth-denied" as const };
  }

  await requestTestNotificationPermission();

  const started = await startMonitoring({
    ...snapshot.beacon,
    identifier: BEACON_REGION_ID,
  });
  if (!started) return { started: false, reason: "beacon-unavailable" as const };

  return { started: true as const };
};
