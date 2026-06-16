import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSafe } from "@office-manager/api-client";

// AsyncStorage で使う一意のキー
const BACKGROUND_ATTENDANCE_KEY = "office-manager/background-attendance";

// 💡 ジオフェンス側が求めている型定義 (データ構造)
export type BackgroundAttendanceSnapshot = {
  token: string;
  userId: number;
  userName: string;
  officeCode: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  entered: boolean; // 現在オフィスに入っているかどうかの状態
};

export const backgroundAttendanceStorage = {
  // データをロードする
  get: async (): Promise<BackgroundAttendanceSnapshot | null> => {
    try {
      const value = await AsyncStorage.getItem(BACKGROUND_ATTENDANCE_KEY);
      if (!value) return null;
      return JSON.parse(value) as BackgroundAttendanceSnapshot;
    } catch (error) {
      console.warn("Failed to load background attendance snapshot", error);
      return null;
    }
  },

  // データを新規にセットする
  set: async (snapshot: BackgroundAttendanceSnapshot): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        BACKGROUND_ATTENDANCE_KEY,
        JSON.stringify(snapshot),
      );
    } catch (error) {
      console.warn("Failed to save background attendance snapshot", error);
    }
  },

  // 「entered（入室中か否か）」の状態だけを部分的に書き換える（patch）
  patch: async (
    partial: Partial<BackgroundAttendanceSnapshot>,
  ): Promise<void> => {
    try {
      const current = await backgroundAttendanceStorage.get();
      if (!current) return;
      const updated = { ...current, ...partial };
      await AsyncStorage.setItem(
        BACKGROUND_ATTENDANCE_KEY,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.warn("Failed to patch background attendance snapshot", error);
    }
  },

  // ログアウト時などにデータを削除する
  remove: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(BACKGROUND_ATTENDANCE_KEY);
    } catch (error) {
      console.warn("Failed to remove background attendance snapshot", error);
    }
  },
};

// 💡 ユーザー情報とトークン、オフィスの情報からスナップショットを作成する関数
export const createBackgroundAttendanceSnapshot = (
  token: string,
  user: UserSafe,
): BackgroundAttendanceSnapshot | null => {
  // 💡 型エラーを回避しつつ、指定された座標データを直接叩き込む
  return {
    token,
    userId: user.id,
    userName: user.name,
    officeCode: (user.office as any)?.code || "OKAYAMA",
    latitude: 34.697149, // 👈 直接指定
    longitude: 133.927746, // 👈 直接指定
    radiusMeters: 2, // 👈 直接指定 (半径2m)
    entered: false, // 初期値は未入室
  };
};
