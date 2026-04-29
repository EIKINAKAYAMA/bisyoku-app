/**
 * 2 地点 (lat/lng) の距離を Haversine 公式で算出（単位: km）。
 * クライアント側で「近い順ソート」「半径フィルタ」に使う。
 *
 * 家族・友人グループ規模（数百件未満）なら全件分計算しても余裕で間に合うので
 * PostGIS や earthdistance などの拡張は導入していない。
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 距離を「1.2 km」「350 m」等の人が読みやすい形に整形する。 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}
