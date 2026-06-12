import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSafe } from "@office-manager/api-client";
import { getOfficeLocation } from "@/utils/location";

const BACKGROUND_ATTENDANCE_KEY = "office-manager/background-attendance";

export type BackgroundAttendanceSnapshot = {
  token: string;
  userId: number;
  userName: string;
  officeCode: string;
  officeName: string;
  entered: boolean;
  latitude: number;
  longitude: number;
  radiusMeters: number;
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
      typeof value.latitude === "number" &&
      typeof value.longitude === "number" &&
      typeof value.radiusMeters === "number"
  );

export const createBackgroundAttendanceSnapshot = (
  token: string,
  user: UserSafe
): BackgroundAttendanceSnapshot | null => {
  const officeLocation = getOfficeLocation(user.office);
  if (!token || !officeLocation || !user.office?.code || !user.office?.name) {
    return null;
  }

  return {
    token,
    userId: user.id,
    userName: user.name,
    officeCode: user.office.code,
    officeName: user.office.name,
    entered: Boolean(user.entered),
    latitude: officeLocation.latitude,
    longitude: officeLocation.longitude,
    radiusMeters: officeLocation.radiusMeters,
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
