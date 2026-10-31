/**
 * ビーコンによる自動入退室
 *
 * 流れ（詳しくは README の「自動入退室のしくみ」）
 * 1. ログイン後、ホーム画面で ensureBackgroundAttendanceMonitoring が許可を求めて監視を始める
 * 2. OS がビーコンの圏内・圏外を知らせる（アプリが終了していても OS が起こす）
 *    - iOS: ここ（JS）で受け取り、サーバーの在室状態と照らして /arrive・/leave を呼ぶ
 *    - Android: JS が動かないことがあるため、ネイティブ（AttendanceWorker.kt）が同じことをする
 * 3. サーバーが入退室を保留し、時間が過ぎたら確定して Discord に通知する
 *
 * App.tsx がこのファイルを最初に読み込み、OS に起こされたときもイベントを受け取れるようにしている。
 */
import type { UserSafe } from "@office-manager/api-client";
import { AppState } from "react-native";
import { API_BASE_URL, TEST_MODE } from "@/constants/config";
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
import { fetchServerAttendance, postBeaconState } from "./beacon/attendanceApi";
import { ACTION_PATHS, decideBeaconAction } from "./beacon/attendanceDecision";
import type { MonitoringResult } from "./beacon/monitoringMessage";
import {
  confirmBackgroundLocationDisclosure,
  requestBluetoothScanPermission,
  requestLocationPermission,
  requestTestNotificationPermission,
} from "./beacon/permissions";

const BEACON_REGION_ID = "office-manager-beacon";

type AttendanceListener = () => void;
const attendanceListeners = new Set<AttendanceListener>();

/** 自動入退室の記録が変わりそうなときに呼ばれる（画面で在室状況を取り直す） */
export const onBackgroundAttendanceChanged = (listener: AttendanceListener) => {
  attendanceListeners.add(listener);
  return () => {
    attendanceListeners.delete(listener);
  };
};

// 入室の保留は、確認の時間（サーバーの ENTER_CONFIRM_MINUTES = 1分）が過ぎると確定する。
// 画面を開いたままでも入室中の表示に変わるよう、過ぎたころに在室状況を取り直してもらう
export const ENTER_CONFIRM_REFRESH_MS = 65 * 1000;
let confirmRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleConfirmRefresh = () => {
  if (confirmRefreshTimer) clearTimeout(confirmRefreshTimer);
  confirmRefreshTimer = setTimeout(() => {
    confirmRefreshTimer = null;
    attendanceListeners.forEach(listener => listener());
  }, ENTER_CONFIRM_REFRESH_MS);
};

/** ビーコンの状態を入退室に反映する（iOS）。どの API を呼ぶかは decideBeaconAction が決める */
export const applyBeaconState = async (state: BeaconRegionState) => {
  const snapshot = await backgroundAttendanceStorage.get();
  if (!snapshot) return;

  const server = await fetchServerAttendance(snapshot);
  if (server && server.entered !== snapshot.entered) {
    await backgroundAttendanceStorage.patch({ entered: server.entered });
  }
  // サーバーに繋がらなければ、端末に覚えている在室状態で判断する
  const action = decideBeaconAction(
    state,
    server ?? {
      entered: snapshot.entered,
      enterPending: false,
      exitPending: false,
    }
  );
  if (action === "none") return;

  try {
    await postBeaconState(snapshot, ACTION_PATHS[action]);
    if (action === "requestEnter") scheduleConfirmRefresh();
  } catch (error) {
    console.warn("Failed to handle beacon event", error);
  }
};

// イベントは届いた順に 1 つずつ処理する（入ってすぐ出たときに順番が入れ替わらないように）
let processing: Promise<void> = Promise.resolve();
const enqueue = (state: BeaconRegionState) => {
  processing = processing.then(() => applyBeaconState(state));
  return processing;
};

// モジュール読み込み時（バックグラウンド起動時を含む）にリスナーを登録する
if (handlesAttendanceNatively) {
  // Android は検知後の記録までネイティブ側で行うので、入室を保留にしたことだけ受け取る
  addAttendanceChangedListener(() => scheduleConfirmRefresh());
} else {
  addRegionStateListener(event => {
    void enqueue(event.state);
  });
}

/** ビーコンの現在の状態を OS に問い合わせ、サーバーの在室状態とずれていれば直す */
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

/** 端末に覚え、Android ではネイティブ側にも API の呼び出しに必要な情報を渡す */
const saveSnapshot = async (snapshot: BackgroundAttendanceSnapshot) => {
  await backgroundAttendanceStorage.set(snapshot);
  if (handlesAttendanceNatively) {
    await setAttendanceConfig({
      apiBaseUrl: API_BASE_URL,
      token: snapshot.token,
      userId: snapshot.userId,
      testMode: TEST_MODE,
    });
  }
};

/** ログイン・ログアウトのたびに呼ばれ、覚えている情報を最新にする */
export const syncBackgroundAttendanceSnapshot = async (
  token: string | null,
  user: UserSafe | null
) => {
  const snapshot =
    token && user ? createBackgroundAttendanceSnapshot(token, user) : null;
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

/** 許可を求めて、ビーコンの監視を始める。始められなければ理由を返す */
export const ensureBackgroundAttendanceMonitoring = async (
  token: string,
  user: UserSafe
): Promise<MonitoringResult> => {
  const snapshot = createBackgroundAttendanceSnapshot(token, user);
  if (!snapshot) return { started: false, reason: "unsupported-office" };
  if (!isBeaconSupported)
    return { started: false, reason: "beacon-unavailable" };

  if (!(await confirmBackgroundLocationDisclosure())) {
    return { started: false, reason: "disclosure-declined" };
  }
  if (!(await requestLocationPermission("foreground"))) {
    return { started: false, reason: "foreground-denied" };
  }
  const backgroundGranted = await requestLocationPermission("background");

  // 「常に許可」がなくても、あとで許可されたときのために覚えておく
  await saveSnapshot(snapshot);

  if (!backgroundGranted)
    return { started: false, reason: "background-denied" };
  if (!(await requestBluetoothScanPermission())) {
    return { started: false, reason: "bluetooth-denied" };
  }
  await requestTestNotificationPermission();

  const started = await startMonitoring({
    ...snapshot.beacon,
    identifier: BEACON_REGION_ID,
  });
  return started
    ? { started: true }
    : { started: false, reason: "beacon-unavailable" };
};
