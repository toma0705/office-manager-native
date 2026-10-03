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
