/**
 * ビーコンの自動検知に必要な許可を求める
 * - 位置情報の「常に許可」（iBeacon の領域監視は位置情報サービスの一部）
 * - Android 12 以降: Bluetooth のスキャン（「付近のデバイス」）
 * - Android のテストモード: 通知
 */
import * as Location from "expo-location";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import { TEST_MODE } from "@/constants/config";

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
 * 用途をアプリ内で説明して同意を得る必要がある（Android のみ）。
 */
export const confirmBackgroundLocationDisclosure = async () => {
  if (Platform.OS !== "android") return true;
  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status === "granted") return true;
  return confirmAsync(
    "位置情報の利用について",
    "このアプリは、オフィスへの入退室を自動で記録するために、アプリを閉じているときや使用していないときも、位置情報と Bluetooth を使ってオフィスのビーコンを検知します。\n\n次の画面で位置情報を「常に許可」に設定してください。"
  );
};

const LOCATION_PERMISSIONS = {
  foreground: {
    get: Location.getForegroundPermissionsAsync,
    request: Location.requestForegroundPermissionsAsync,
  },
  background: {
    get: Location.getBackgroundPermissionsAsync,
    request: Location.requestBackgroundPermissionsAsync,
  },
};

/** 位置情報の許可を確かめ、まだなら（聞ける場合だけ）求める。許可されていれば true */
export const requestLocationPermission = async (
  kind: keyof typeof LOCATION_PERMISSIONS
) => {
  const { get, request } = LOCATION_PERMISSIONS[kind];
  const current = await get();
  if (current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  return (await request()).status === "granted";
};

/** Android 12 以降は Bluetooth のスキャンに「付近のデバイス」の許可が必要 */
export const requestBluetoothScanPermission = async () => {
  if (Platform.OS !== "android" || Number(Platform.Version) < 31) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

/** テストモードの通知（Android 13 以降は許可が必要）。許可がなくても監視は続ける */
export const requestTestNotificationPermission = async () => {
  if (!TEST_MODE || Platform.OS !== "android" || Number(Platform.Version) < 33)
    return;
  await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
};
