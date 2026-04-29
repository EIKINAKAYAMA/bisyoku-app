/**
 * Google Maps の URL から緯度経度を抽出する。
 * 詳細画面の地図にピンを立てるために使用。
 *
 * 主要 3 パターンに対応：
 *   - `@<lat>,<lng>,<zoom>z`（Place ページの URL に多い）
 *   - `?q=<lat>,<lng>` / `&q=<lat>,<lng>`（共有 URL の一部）
 *   - `!3d<lat>!4d<lng>`（埋め込み URL のメタ情報）
 *
 * 短縮 URL（`maps.app.goo.gl/*`、`goo.gl/maps/*`）はリダイレクト解決が必要で
 * ブラウザ fetch では CORS で塞がれるため未対応。
 * 短縮 URL でも外部ボタン（リンクの open）は機能するが、地図プレビューは出ない。
 */
export function extractCoordsFromMapsUrl(
  url: string | null | undefined
): { lat: number; lng: number } | null {
  if (!url) return null
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ) {
        return { lat, lng }
      }
    }
  }
  return null
}
