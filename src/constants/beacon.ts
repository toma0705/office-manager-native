export type OfficeBeacon = {
  uuid: string;
  major: number;
  minor: number;
};

/** オフィスに置いた ESP32 の iBeacon の設定（firmware/office_beacon/office_beacon.ino と一致させる） */
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
