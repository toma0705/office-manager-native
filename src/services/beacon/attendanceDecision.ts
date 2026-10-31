/**
 * ビーコンの状態（圏内・圏外）とサーバーの在室状態から、どの操作をするかを決める。
 * Android は同じ判定を Kotlin（modules/office-beacon/.../AttendanceDecision.kt）でしている。
 * どちらも modules/office-beacon/test-fixtures/attendance-decisions.json の表でテストしている。
 *
 * 圏内・圏外になってもすぐには入退室にせず、サーバーで保留にする。
 * - 入室: 確認の時間（1 分）の間に圏外にならなければ、サーバーが入室を確定して Discord に通知する
 * - 退室: 猶予（15 分）の間に戻らなければ、サーバーが退室を確定して Discord に通知する
 */
import type { BeaconRegionState } from "../../../modules/office-beacon/src";

export type ServerAttendance = {
  entered: boolean;
  /** 入室の保留中（圏内になったが、まだ確認の時間が過ぎていない） */
  enterPending: boolean;
  /** 退室の保留中（圏外になったが、まだ猶予が過ぎていない） */
  exitPending: boolean;
};

export type BeaconAction =
  | "requestEnter" // 入室の保留を始める
  | "cancelExit" // 退室の保留を取り消す
  | "requestExit" // 退室の保留を始める
  | "cancelEnter" // 入室の保留を取り消す
  | "none";

export const decideBeaconAction = (
  state: BeaconRegionState,
  server: ServerAttendance
): BeaconAction => {
  if (state === "inside") {
    if (!server.entered && !server.enterPending) return "requestEnter";
    if (server.exitPending) return "cancelExit";
    return "none";
  }
  if (server.entered && !server.exitPending) return "requestExit";
  if (server.enterPending) return "cancelEnter";
  return "none";
};

/** 操作ごとに呼ぶ API（圏内なら /arrive、圏外なら /leave。サーバーが状態に応じて処理する） */
export const ACTION_PATHS = {
  requestEnter: "arrive",
  cancelExit: "arrive",
  requestExit: "leave",
  cancelEnter: "leave",
} as const satisfies Record<Exclude<BeaconAction, "none">, "arrive" | "leave">;

/** /users/me の user からサーバーの在室状態を読む。形が違えば null */
export const parseServerAttendance = (
  user: unknown
): ServerAttendance | null => {
  if (!user || typeof user !== "object") return null;
  const { entered, enterPendingSince, exitPendingSince } = user as Record<
    string,
    unknown
  >;
  if (typeof entered !== "boolean") return null;
  return {
    entered,
    enterPending: !entered && enterPendingSince != null,
    exitPending: entered && exitPendingSince != null,
  };
};
