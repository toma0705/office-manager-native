import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSafe } from "@office-manager/api-client";
import { getOfficeBeacon, type OfficeBeacon } from "@/constants/beacon";

const BACKGROUND_ATTENDANCE_KEY = "office-manager/background-attendance";

export type BackgroundAttendanceSnapshot = {
  token: string;
  userId: number;
  userName: string;
  officeCode: string;
  officeName: string;
  entered: boolean;
  beacon: OfficeBeacon;
  /** 最後に入退室を記録した時刻 (ms)。チャタリング防止に使う */
  lastTransitionAt: number;
  /** クールダウンで保留中のビーコン状態 */
  pendingState: "inside" | "outside" | null;
};

const isSnapshot = (
  value: Partial<BackgroundAttendanceSnapshot> | null | undefined
): value is BackgroundAttendanceSnapshot =>
  Boolean(
    value &&
      typeof value.token === "string" &&
      typeof value.userId === "number" &&
      typeof value.userName === "string" &&
      typeof value.officeCode === "string" &&
      typeof value.officeName === "string" &&
      typeof value.entered === "boolean" &&
      typeof value.beacon?.uuid === "string" &&
      typeof value.lastTransitionAt === "number"
  );

export const createBackgroundAttendanceSnapshot = (
  token: string,
  user: UserSafe
): BackgroundAttendanceSnapshot | null => {
  const beacon = getOfficeBeacon(user.office);
  if (!token || !beacon || !user.office?.code || !user.office?.name) {
    return null;
  }

  return {
    token,
    userId: user.id,
    userName: user.name,
    officeCode: user.office.code,
    officeName: user.office.name,
    entered: Boolean(user.entered),
    beacon,
    lastTransitionAt: 0,
    pendingState: null,
  };
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
    try {
      const current = await backgroundAttendanceStorage.get();
      if (!current) return;
      await backgroundAttendanceStorage.set({ ...current, ...updates });
    } catch (error) {
      console.warn("Failed to patch background attendance snapshot", error);
    }
  },
  remove: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(BACKGROUND_ATTENDANCE_KEY);
    } catch (error) {
      console.warn("Failed to clear background attendance snapshot", error);
    }
  },
};
