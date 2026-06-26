// utils/location.ts (または共通の場所に作成)
import * as Location from "expo-location";

export const getDistanceToOffice = async (
  officeLat: number,
  officeLon: number,
) => {
  const current = await Location.getCurrentPositionAsync({});

  // expo-location には直接距離計算はないので、Haversine公式などを使います
  const toRad = (value: number) => (value * Math.PI) / 180;

  const R = 6371e3; // 地球の半径 (メートル)
  const lat1 = toRad(current.coords.latitude);
  const lat2 = toRad(officeLat);
  const deltaLat = toRad(officeLat - current.coords.latitude);
  const deltaLon = toRad(officeLon - current.coords.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // メートルで返す
};
