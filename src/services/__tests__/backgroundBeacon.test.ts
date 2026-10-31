/**
 * iOS のビーコン検知の流れ（Android は AttendanceWorker.kt が同じことをする）
 */
import type { BackgroundAttendanceSnapshot } from "@/storage/backgroundAttendanceStorage";

// 端末に覚えている情報（モジュールの読み込み時にも読まれるので、モックの中に持つ）
jest.mock("@/storage/backgroundAttendanceStorage", () => {
  const state: { snapshot: BackgroundAttendanceSnapshot | null } = {
    snapshot: null,
  };
  return {
    ...jest.requireActual("@/storage/backgroundAttendanceStorage"),
    state,
    backgroundAttendanceStorage: {
      get: jest.fn(async () => state.snapshot),
      set: jest.fn(async (s: BackgroundAttendanceSnapshot) => {
        state.snapshot = s;
      }),
      patch: jest.fn(async (u: Partial<BackgroundAttendanceSnapshot>) => {
        if (state.snapshot) state.snapshot = { ...state.snapshot, ...u };
      }),
      remove: jest.fn(async () => {
        state.snapshot = null;
      }),
    },
  };
});

jest.mock("../../../modules/office-beacon/src", () => ({
  addAttendanceChangedListener: jest.fn(),
  addRegionStateListener: jest.fn(),
  handlesAttendanceNatively: false,
  isBeaconSupported: true,
  refreshState: jest.fn(),
  setAttendanceConfig: jest.fn(),
  startMonitoring: jest.fn(async () => true),
  stopMonitoring: jest.fn(),
}));

jest.mock("@/services/beacon/permissions", () => ({
  confirmBackgroundLocationDisclosure: jest.fn(async () => true),
  requestLocationPermission: jest.fn(async () => true),
  requestBluetoothScanPermission: jest.fn(async () => true),
  requestTestNotificationPermission: jest.fn(async () => undefined),
}));

import {
  applyBeaconState,
  ensureBackgroundAttendanceMonitoring,
  ENTER_CONFIRM_REFRESH_MS,
  onBackgroundAttendanceChanged,
} from "../backgroundBeacon";

const mockStorage = jest.requireMock("@/storage/backgroundAttendanceStorage")
  .state as { snapshot: BackgroundAttendanceSnapshot | null };
const beaconModule = jest.requireMock("../../../modules/office-beacon/src");
const permissions = jest.requireMock("@/services/beacon/permissions");

const beacon = {
  uuid: "12345678-1234-1234-1234-123456789ABC",
  major: 1,
  minor: 1,
};
const snapshot = (entered: boolean): BackgroundAttendanceSnapshot => ({
  token: "token",
  userId: 7,
  entered,
  beacon,
});

const fetchMock = jest.fn();
global.fetch = fetchMock;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** /users/me の応答（サーバーの在室状態）。null ならサーバーに繋がらない */
const respondMe = (user: Record<string, unknown> | null) =>
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/users/me")) {
      if (!user) throw new TypeError("Network request failed");
      return json({ user: { id: 7, ...user }, enteredUsers: [] });
    }
    return json({ status: "pending" });
  });

const postedPaths = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([url]) => (url as string).replace(/^.*\/api/, ""));

const authorizationOf = (call: unknown[]) =>
  new Headers((call[1] as RequestInit).headers).get("Authorization");

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.snapshot = snapshot(false);
});

describe("applyBeaconState", () => {
  it("退室中に圏内になったら /arrive を呼び、約 1 分後に画面へ取り直しを頼む", async () => {
    jest.useFakeTimers();
    respondMe({ entered: false, enterPendingSince: null });
    const listener = jest.fn();
    const unsubscribe = onBackgroundAttendanceChanged(listener);

    await applyBeaconState("inside");
    expect(postedPaths()).toEqual(["/users/7/arrive"]);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer token",
    });

    jest.advanceTimersByTime(ENTER_CONFIRM_REFRESH_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    jest.useRealTimers();
  });

  it("入室の保留中に圏内のままなら、何も呼ばない", async () => {
    respondMe({ entered: false, enterPendingSince: "2026-11-01T00:00:00Z" });
    await applyBeaconState("inside");
    expect(postedPaths()).toEqual([]);
  });

  it("入室中に圏外になったら /leave を呼ぶ", async () => {
    mockStorage.snapshot = snapshot(true);
    respondMe({ entered: true, exitPendingSince: null });
    await applyBeaconState("outside");
    expect(postedPaths()).toEqual(["/users/7/leave"]);
  });

  it("サーバーの在室状態と端末の記録がずれていたら、端末の記録を直す", async () => {
    mockStorage.snapshot = snapshot(false);
    respondMe({ entered: true, exitPendingSince: null });
    await applyBeaconState("inside");
    expect(mockStorage.snapshot?.entered).toBe(true);
    expect(postedPaths()).toEqual([]);
  });

  it("サーバーに繋がらなければ、端末に覚えている在室状態で判断する", async () => {
    mockStorage.snapshot = snapshot(true);
    respondMe(null);
    await applyBeaconState("outside");
    expect(postedPaths()).toEqual(["/users/7/leave"]);
  });

  it("ログインしていなければ（覚えている情報がなければ）何もしない", async () => {
    mockStorage.snapshot = null;
    await applyBeaconState("inside");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("API が失敗してもエラーを投げない", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/users/me")
        ? json({ user: { id: 7, entered: false }, enteredUsers: [] })
        : json({ error: "server error" }, 500)
    );
    await expect(applyBeaconState("inside")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("ensureBackgroundAttendanceMonitoring", () => {
  const user = {
    id: 7,
    name: "テスト",
    email: "t@4nonome.com",
    iconFileName: "",
    officeId: 1,
    office: { id: 1, code: "OKAYAMA", name: "岡山オフィス" },
    entered: false,
  };

  it("許可がそろえば、オフィスのビーコンの監視を始める", async () => {
    await expect(
      ensureBackgroundAttendanceMonitoring("token", user)
    ).resolves.toEqual({
      started: true,
    });
    expect(beaconModule.startMonitoring).toHaveBeenCalledWith({
      ...beacon,
      identifier: "office-manager-beacon",
    });
  });

  it("ビーコンを置いていないオフィスでは始めない", async () => {
    const tokyo = {
      ...user,
      office: { id: 2, code: "TOKYO", name: "東京オフィス" },
    };
    await expect(
      ensureBackgroundAttendanceMonitoring("token", tokyo)
    ).resolves.toEqual({
      started: false,
      reason: "unsupported-office",
    });
    expect(permissions.requestLocationPermission).not.toHaveBeenCalled();
  });

  it("位置情報が「常に許可」でなければ始めないが、情報は覚えておく", async () => {
    permissions.requestLocationPermission.mockImplementation(
      async (kind: string) => kind === "foreground"
    );
    await expect(
      ensureBackgroundAttendanceMonitoring("token", user)
    ).resolves.toEqual({
      started: false,
      reason: "background-denied",
    });
    expect(mockStorage.snapshot).toMatchObject({ userId: 7, token: "token" });
    expect(beaconModule.startMonitoring).not.toHaveBeenCalled();
  });

  it.each([
    ["disclosure-declined", "confirmBackgroundLocationDisclosure"],
    ["bluetooth-denied", "requestBluetoothScanPermission"],
  ])("%s: 許可されなければ始めない", async (reason, permission) => {
    permissions.requestLocationPermission.mockResolvedValue(true);
    permissions[permission].mockResolvedValueOnce(false);
    await expect(
      ensureBackgroundAttendanceMonitoring("token", user)
    ).resolves.toEqual({
      started: false,
      reason,
    });
  });
});
