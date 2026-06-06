import type { Office } from "@office-manager/api-client";

export const DEFAULT_GEOFENCE_RADIUS_METERS = 2;
export const EXIT_BUFFER_METERS = 48;

export type OfficeLocation = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

type GeofencedOffice = Office & {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
};

const OFFICE_LOCATION_BY_CODE: Record<string, OfficeLocation> = {
  OKAYAMA: {
    latitude: 34.697131,
    longitude: 133.927744,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
};

const toRadians = (value: number) => (value * Math.PI) / 180;

export const getOfficeLocation = (
  office?: GeofencedOffice | null
): OfficeLocation | null => {
  if (office?.code) {
    const fallback = OFFICE_LOCATION_BY_CODE[office.code];
    if (fallback) {
      return {
        latitude:
          typeof office.latitude === "number"
            ? office.latitude
            : fallback.latitude,
        longitude:
          typeof office.longitude === "number"
            ? office.longitude
            : fallback.longitude,
        radiusMeters: office.radiusMeters ?? fallback.radiusMeters,
      };
    }
  }

  if (
    !office ||
    typeof office.latitude !== "number" ||
    typeof office.longitude !== "number"
  ) {
    return null;
  }

  return {
    latitude: office.latitude,
    longitude: office.longitude,
    radiusMeters: office.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
  };
};

export const calculateDistanceMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) => {
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
    Math.cos(toLatitude) *
    Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const shouldAutoEnter = (
  distanceMeters: number,
  office: OfficeLocation
) => distanceMeters <= office.radiusMeters;

export const shouldAutoExit = (
  distanceMeters: number,
  office: OfficeLocation
) => distanceMeters > office.radiusMeters + EXIT_BUFFER_METERS;
