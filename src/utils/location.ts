import * as Location from "expo-location";

/**
 * 現在地からオフィスまでの距離をメートルで計算する
 * @param officeLat オフィスの緯度
 * @param officeLon オフィスの経度
 * @returns 距離（メートル）
 */
export const getDistanceToOffice = async (
  officeLat: number,
  officeLon: number,
): Promise<number> => {
  // キャッシュを避け、最新かつ高精度の位置情報を取得する
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  // Haversine公式による距離計算
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

  return R * c;
};
