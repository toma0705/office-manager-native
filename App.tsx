import React, { useEffect } from "react";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { App as RootApp } from "./src/App";
import { withApiPath } from "./src/constants/config"; // APIのベースURLインポート

const GEOFENCING_TASK_NAME = "OFFICE_AUTO_ATTENDANCE_TASK";
const TOKEN_KEY = "office-manager/token";

// 💡 JWTトークンから中身（ユーザーIDや名前）をパースする軽量デコーダー
const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload) as {
      id: number;
      name: string;
      officeCode: string | null;
    };
  } catch (error) {
    console.error("トークンのデコードに失敗しました:", error);
    return null;
  }
};

// 💡 バックグラウンド専用の打刻・通知兼用リクエスト関数
const sendAttendanceRequest = async (
  action: "enter" | "exit",
  token: string,
  userId: number,
  userName: string,
  officeCode: string | null,
) => {
  try {
    // 1. 打刻APIを叩く
    const attendanceRes = await fetch(
      withApiPath(`/users/${userId}/${action}`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!attendanceRes.ok)
      throw new Error(`打刻APIリクエストが失敗しました (${action})`);

    // 2. 通知APIを叩く（Slackや入室中リストへの反映用）
    const statusText = action === "enter" ? "入室" : "退室";
    await fetch(withApiPath("/notify"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notifyPostRequest: {
          user: userName,
          status: statusText,
          officeCode: officeCode,
          note: null,
        },
      }),
    });

    console.log(`【バックグラウンド】自動${statusText}が完全に完了しました！`);
  } catch (error) {
    console.error(
      `【バックグラウンド】${action}処理中にエラーが発生しました:`,
      error,
    );
  }
};

// 💡 2. OSからの「エリア出入り」通知を受け取る裏口（タスク）
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("ジオフェンスタスクでエラーが発生しました:", error);
    return;
  }

  const geofenceData = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  const { eventType, region } = geofenceData;

  // 💡 スマホのセーブデータからトークンを取り出す
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) {
    console.log(
      "【バックグラウンド】トークンがないため、自動打刻をスキップします",
    );
    return;
  }

  // 💡 トークンを解析してユーザー情報を取得
  const decoded = decodeJwt(token);
  if (!decoded) return;

  const { id: userId, name: userName, officeCode } = decoded;

  // 1 ➔ エリアに入った (Enter) / 2 ➔ エリアから出た (Exit)
  if (eventType === Location.GeofencingEventType.Enter) {
    console.log("【バックグラウンド】オフィスへの入室を検知しました", region);
    await sendAttendanceRequest("enter", token, userId, userName, officeCode);
  } else if (eventType === Location.GeofencingEventType.Exit) {
    console.log("【バックグラウンド】オフィスからの退室を検知しました", region);
    await sendAttendanceRequest("exit", token, userId, userName, officeCode);
  }
});

export default function App() {
  // 💡 3. アプリ起動時に、オフィスの監視をOSに登録する（種まき）
  useEffect(() => {
    const startMonitoringOffice = async () => {
      try {
        const { status } = await Location.getBackgroundPermissionsAsync();
        if (status !== "granted") return;

        const isStarted =
          await Location.hasStartedGeofencingAsync(GEOFENCING_TASK_NAME);
        if (isStarted) return;

        // 🛠️ テスト用に一旦仮の値（例：オフィスの緯度経度、半径20m）を登録します。
        // ※ 最終的には、ログイン後のHomeScreen等で本物のユーザーのオフィスデータを指定して再登録させる動線にすると完璧です。
        const officeLatitude = 35.681236;
        const officeLongitude = 139.767125;
        const officeRadius = 20;

        await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, [
          {
            identifier: "MY_OFFICE",
            latitude: officeLatitude,
            longitude: officeLongitude,
            radius: officeRadius,
          },
        ]);

        console.log("OSへのオフィスジオフェンス登録が完了しました！");
      } catch (err) {
        console.warn("ジオフェンスの登録に失敗しました:", err);
      }
    };

    void startMonitoringOffice();
  }, []);

  return <RootApp />;
}
