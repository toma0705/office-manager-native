export type OfficeBeacon = {
  uuid: string;
  major: number;
  minor: number;
};

/** ESP32 の iBeacon 設定（firmware/office_beacon.ino と一致させること） */
const OFFICE_BEACON_BY_CODE: Record<string, OfficeBeacon> = {
  OKAYAMA: {
    uuid: "12345678-1234-1234-1234-123456789ABC",
    major: 1,
    minor: 1,
  },
};

export const getOfficeBeacon = (
  office?: { code?: string | null } | null
): OfficeBeacon | null =>
  (office?.code && OFFICE_BEACON_BY_CODE[office.code]) || null;

/**
 * チャタリング防止: 直前の入退室から この時間内は反対方向のイベントを即時処理せず保留する。
 * 保留分はアプリ表示中の定期チェックや次のイベントで再評価される。
 */
export const MIN_TRANSITION_INTERVAL_MS = 2 * 60 * 1000;
