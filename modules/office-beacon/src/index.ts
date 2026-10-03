import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type BeaconRegionState = "inside" | "outside";

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
  addListener(
    eventName: "onRegionState",
    listener: (event: BeaconRegionEvent) => void
  ): { remove(): void };
};

const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<NativeOfficeBeacon>("OfficeBeacon")
    : null;

export const isBeaconSupported = native !== null;

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
