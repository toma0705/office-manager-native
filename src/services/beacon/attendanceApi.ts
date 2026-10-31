/**
 * ビーコンの検知で呼ぶ API（iOS 用。Android は AttendanceWorker.kt が同じ API を呼ぶ）
 */
import { createAttendanceApi, createUsersApi } from "@/api/client";
import type { BackgroundAttendanceSnapshot } from "@/storage/backgroundAttendanceStorage";
import {
  parseServerAttendance,
  type ServerAttendance,
} from "./attendanceDecision";

/** /arrive（圏内）または /leave（圏外）を呼ぶ。失敗したらエラーを投げる */
export const postBeaconState = async (
  snapshot: BackgroundAttendanceSnapshot,
  path: "arrive" | "leave"
) => {
  const api = createAttendanceApi(snapshot.token);
  const params = { id: snapshot.userId };
  if (path === "arrive") await api.usersIdArrivePost(params);
  else await api.usersIdLeavePost(params);
};

/**
 * サーバー上の在室状態を取得する。Web での手動の入退室などで端末の記録とずれるため、
 * 判定はサーバーを正とする。取得できなければ null。
 */
export const fetchServerAttendance = async (
  snapshot: BackgroundAttendanceSnapshot
): Promise<ServerAttendance | null> => {
  try {
    const { user } = await createUsersApi(snapshot.token).usersMeGet();
    return parseServerAttendance(user);
  } catch {
    return null;
  }
};
