import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import {
  listRestaurants,
  type RestaurantFilters,
  type RestaurantWithSummary,
} from '@/features/restaurants/api'
import { listGenres } from '@/features/genres/api'
import { PRICE_RANGES, type PriceRange } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = '__all__'

export function RestaurantList() {
  const [query, setQuery] = useState('')
  const [genreId, setGenreId] = useState<string>(ALL)
  const [priceRange, setPriceRange] = useState<string>(ALL)
  const [minOverall, setMinOverall] = useState<string>(ALL)

  const filters: RestaurantFilters = useMemo(
    () => ({
      query: query.trim() || undefined,
      genreId: genreId === ALL ? undefined : genreId,
      priceRange: priceRange === ALL ? undefined : (priceRange as PriceRange),
      minOverall: minOverall === ALL ? undefined : Number(minOverall),
    }),
    [query, genreId, priceRange, minOverall]
  )

  const restaurantsQuery = useQuery({
    queryKey: ['restaurants', filters],
    queryFn: () => listRestaurants(filters),
  })

  const genresQuery = useQuery({
    queryKey: ['genres'],
    queryFn: listGenres,
  })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="店名で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FilterSelect
            label="ジャンル"
            value={genreId}
            onValueChange={setGenreId}
            options={[
              { value: ALL, label: '全て' },
              ...(genresQuery.data ?? []).map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <FilterSelect
            label="価格帯"
            value={priceRange}
            onValueChange={setPriceRange}
            options={[
              { value: ALL, label: '全て' },
              ...PRICE_RANGES.map((p) => ({ value: p, label: p })),
            ]}
          />
          <FilterSelect
            label="総合 ≥"
            value={minOverall}
            onValueChange={setMinOverall}
            options={[
              { value: ALL, label: '全て' },
              ...[5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `${n}` })),
            ]}
          />
        </div>
      </div>

      {restaurantsQuery.isLoading && (
        <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
      )}
      {restaurantsQuery.isError && (
        <p className="py-12 text-center text-destructive">
          読み込みに失敗しました：{(restaurantsQuery.error as Error).message}
        </p>
      )}
      {restaurantsQuery.data && restaurantsQuery.data.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          条件に一致する店舗がありません。
        </p>
      )}

      <ul className="space-y-2">
        {restaurantsQuery.data?.map((r) => (
          <li key={r.id}>
            <RestaurantRow restaurant={r} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: string
  onValueChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function RestaurantRow({ restaurant: r }: { restaurant: RestaurantWithSummary }) {
  const avg = r.summary?.avg_overall
  const count = r.summary?.rating_count ?? 0
  return (
    <Link to={`/restaurants/${r.id}`} className="block">
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.genre?.name ?? '未分類'} ・ {r.price_range}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold leading-none">
                {avg != null ? avg.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {count > 0 ? `${count} 件` : '未評価'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
