import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSafe } from "@office-manager/api-client";
import { getOfficeBeacon, type OfficeBeacon } from "@/constants/beacon";

const BACKGROUND_ATTENDANCE_KEY = "office-manager/background-attendance";

/**
 * ビーコンの検知で API を呼ぶために端末に覚えておく情報。
 * OS がアプリをバックグラウンドで起こしたときは画面の状態がないので、ここから読む。
 */
export type BackgroundAttendanceSnapshot = {
  token: string;
  userId: number;
  /** サーバーに繋がらなかったときに使う、最後に知っている在室状態 */
  entered: boolean;
  beacon: OfficeBeacon;
};

export const isSnapshot = (
  value: Partial<BackgroundAttendanceSnapshot> | null | undefined
): value is BackgroundAttendanceSnapshot =>
  Boolean(
    value &&
    typeof value.token === "string" &&
    typeof value.userId === "number" &&
    typeof value.entered === "boolean" &&
    typeof value.beacon?.uuid === "string"
  );

export const createBackgroundAttendanceSnapshot = (
  token: string,
  user: UserSafe
): BackgroundAttendanceSnapshot | null => {
  // ビーコンを置いていないオフィスでは監視しない
  const beacon = getOfficeBeacon(user.office);
  if (!token || !beacon) return null;

  return { token, userId: user.id, entered: Boolean(user.entered), beacon };
};

export const backgroundAttendanceStorage = {
  get: async (): Promise<BackgroundAttendanceSnapshot | null> => {
    try {
      const raw = await AsyncStorage.getItem(BACKGROUND_ATTENDANCE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<BackgroundAttendanceSnapshot>;
      return isSnapshot(parsed) ? parsed : null;
    } catch (error) {
      console.warn("Failed to load background attendance snapshot", error);
      return null;
    }
  },
  set: async (snapshot: BackgroundAttendanceSnapshot): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        BACKGROUND_ATTENDANCE_KEY,
        JSON.stringify(snapshot)
      );
    } catch (error) {
      console.warn("Failed to save background attendance snapshot", error);
    }
  },
  patch: async (
    updates: Partial<BackgroundAttendanceSnapshot>
  ): Promise<void> => {
    const current = await backgroundAttendanceStorage.get();
    if (current)
      await backgroundAttendanceStorage.set({ ...current, ...updates });
  },
  remove: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(BACKGROUND_ATTENDANCE_KEY);
    } catch (error) {
      console.warn("Failed to clear background attendance snapshot", error);
    }
  },
};
