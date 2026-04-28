import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownAZ, Plus, Search, Sparkles, TrendingUp } from 'lucide-react'
import {
  listRestaurants,
  type RestaurantFilters,
  type RestaurantSort,
  type RestaurantWithSummary,
} from '@/features/restaurants/api'
import { listGenres } from '@/features/genres/api'
import { useDebounced } from '@/hooks/useDebounced'
import { PRICE_RANGES, type PriceRange } from '@/lib/constants'
import { ratingTone } from '@/lib/rating'
import { Button } from '@/components/ui/button'
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
const PAGE_SIZE = 30

const SORT_OPTIONS: Array<{ value: RestaurantSort; label: string; icon: React.ReactNode }> = [
  { value: 'recent', label: '新着順', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { value: 'rating-high', label: '評価が高い順', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: 'name', label: '名前順', icon: <ArrowDownAZ className="h-3.5 w-3.5" /> },
]

export function RestaurantList() {
  const [query, setQuery] = useState('')
  const [genreId, setGenreId] = useState<string>(ALL)
  const [priceRange, setPriceRange] = useState<string>(ALL)
  const [minOverall, setMinOverall] = useState<string>(ALL)
  const [sort, setSort] = useState<RestaurantSort>('recent')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const debouncedQuery = useDebounced(query, 300)

  const filters: RestaurantFilters = useMemo(
    () => ({
      query: debouncedQuery.trim() || undefined,
      genreId: genreId === ALL ? undefined : genreId,
      priceRange: priceRange === ALL ? undefined : (priceRange as PriceRange),
      minOverall: minOverall === ALL ? undefined : Number(minOverall),
      sort,
      limit,
    }),
    [debouncedQuery, genreId, priceRange, minOverall, sort, limit]
  )

  const restaurantsQuery = useQuery({
    queryKey: ['restaurants', filters],
    queryFn: () => listRestaurants(filters),
  })

  const genresQuery = useQuery({
    queryKey: ['genres'],
    queryFn: listGenres,
  })

  // フィルタを変えたら page を 1 に戻す
  const resetLimit = () => setLimit(PAGE_SIZE)

  const restaurants = restaurantsQuery.data ?? []
  const hasMore = restaurants.length === limit

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">店舗一覧</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            {restaurants.length} 件{hasMore ? '（さらに表示可）' : ''}
          </p>
        </div>
        <Button asChild size="lg" className="hidden md:inline-flex">
          <Link to="/restaurants/new">
            <Plus className="h-4 w-4" /> 店を登録
          </Link>
        </Button>
      </header>

      <div className="space-y-3 rounded-lg border bg-card p-3 md:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="店名で検索"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              resetLimit()
            }}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FilterSelect
            label="ジャンル"
            value={genreId}
            onValueChange={(v) => {
              setGenreId(v)
              resetLimit()
            }}
            options={[
              { value: ALL, label: '全て' },
              ...(genresQuery.data ?? []).map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <FilterSelect
            label="価格帯"
            value={priceRange}
            onValueChange={(v) => {
              setPriceRange(v)
              resetLimit()
            }}
            options={[
              { value: ALL, label: '全て' },
              ...PRICE_RANGES.map((p) => ({ value: p, label: p })),
            ]}
          />
          <FilterSelect
            label="総合 ≥"
            value={minOverall}
            onValueChange={(v) => {
              setMinOverall(v)
              resetLimit()
            }}
            options={[
              { value: ALL, label: '全て' },
              ...[5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `${n}` })),
            ]}
          />
          <FilterSelect
            label="並び"
            value={sort}
            onValueChange={(v) => {
              setSort(v as RestaurantSort)
              resetLimit()
            }}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
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
      {!restaurantsQuery.isLoading && restaurants.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">条件に一致する店舗がありません。</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/restaurants/new">
              <Plus className="h-4 w-4" /> 店を登録する
            </Link>
          </Button>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {restaurants.map((r) => (
          <li key={r.id}>
            <RestaurantCard restaurant={r} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="pt-2 text-center">
          <Button variant="outline" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            もっと見る
          </Button>
        </div>
      )}
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

function RestaurantCard({ restaurant: r }: { restaurant: RestaurantWithSummary }) {
  const avg = r.summary?.avg_overall
  const count = r.summary?.rating_count ?? 0
  return (
    <Link to={`/restaurants/${r.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden border-2 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg">
        <CardContent className="flex h-full items-start justify-between gap-3 p-4 md:p-5">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-base font-semibold md:text-lg">{r.name}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary md:text-xs">
                {r.genre?.name ?? '未分類'}
              </span>
              <span className="rounded-full bg-accent/30 px-2 py-0.5 text-[11px] font-medium text-accent-foreground md:text-xs">
                {r.price_range}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 px-3 py-2">
            <p
              className={`text-2xl font-bold leading-none tabular-nums md:text-3xl ${avg != null ? ratingTone(avg) : 'text-muted-foreground'}`}
            >
              {avg != null ? avg.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {count > 0 ? `${count} 件` : '未評価'}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
