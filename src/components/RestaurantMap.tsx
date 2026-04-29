// OpenStreetMap の埋め込み iframe で地図表示。
// Leaflet などのライブラリを足すと bundle / SW キャッシュが膨らむため、依存ゼロの iframe を採用。
// docs: https://wiki.openstreetmap.org/wiki/Export_tab

type Props = {
  lat: number
  lng: number
  /** 表示倍率（高いほど狭い範囲）。0.005 で約 500m 四方 */
  delta?: number
  /** 高さ（Tailwind のクラスで上書きしたい時に渡せる） */
  className?: string
}

export function RestaurantMap({ lat, lng, delta = 0.005, className }: Props) {
  const bbox = `${lng - delta},${lat - delta * 0.6},${lng + delta},${lat + delta * 0.6}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${lat},${lng}`

  return (
    <iframe
      title="店舗の位置"
      src={src}
      loading="lazy"
      className={className ?? 'h-56 w-full rounded-md border'}
    />
  )
}
