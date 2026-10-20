import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type BeaconRegionState = "inside" | "outside";

export type AttendanceConfig = {
  apiBaseUrl: string;
  token: string;
  userId: number;
  userName: string;
  officeCode: string;
};

export type BeaconRegionEvent = {
  identifier: string;
  state: BeaconRegionState;
  /** "refresh" は requestState による問い合わせ結果、"event" は実際の入退場 */
  source: "event" | "refresh";
};

type NativeOfficeBeacon = {
  startMonitoringAsync(
    uuid: string,
    major: number | null,
    minor: number | null,
    identifier: string
  ): Promise<boolean>;
  stopMonitoringAsync(): Promise<void>;
  refreshStateAsync(): Promise<void>;
  isMonitoringAsync(): Promise<boolean>;
  /** Android のみ。検知後の入退室 API 呼び出しはネイティブ側で行う */
  setAttendanceConfigAsync?(config: AttendanceConfig | null): Promise<void>;
  addListener(
    eventName: "onRegionState",
    listener: (event: BeaconRegionEvent) => void
  ): { remove(): void };
  addListener(
    eventName: "onAttendanceChanged",
    listener: (event: { action: "enter" | "exit" }) => void
  ): { remove(): void };
};

const native =
  Platform.OS === "ios" || Platform.OS === "android"
    ? requireOptionalNativeModule<NativeOfficeBeacon>("OfficeBeacon")
    : null;

export const isBeaconSupported = native !== null;

/**
 * Android ではアプリが終了していると JS が動かないため、
 * ビーコン検知後の入退室 API 呼び出しをネイティブ側で行う。
 */
export const handlesAttendanceNatively = Platform.OS === "android";

export const startMonitoring = async (config: {
  uuid: string;
  major?: number;
  minor?: number;
  identifier: string;
}) =>
  native?.startMonitoringAsync(
    config.uuid,
    config.major ?? null,
    config.minor ?? null,
    config.identifier
  ) ?? false;

export const stopMonitoring = async () => {
  await native?.stopMonitoringAsync();
};

export const refreshState = async () => {
  await native?.refreshStateAsync();
};

export const isMonitoring = async () =>
  (await native?.isMonitoringAsync()) ?? false;

export const addRegionStateListener = (
  listener: (event: BeaconRegionEvent) => void
) => native?.addListener("onRegionState", listener) ?? { remove() {} };

export const setAttendanceConfig = async (config: AttendanceConfig | null) => {
  await native?.setAttendanceConfigAsync?.(config);
};

/** Android のみ。ネイティブ側で入退室を記録したときに呼ばれる */
export const addAttendanceChangedListener = (
  listener: (action: "enter" | "exit") => void
) =>
  native?.addListener("onAttendanceChanged", event =>
    listener(event.action)
  ) ?? { remove() {} };
