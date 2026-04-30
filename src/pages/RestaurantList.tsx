import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Award,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  listRestaurantAreas,
  listRestaurants,
  type RestaurantFilters,
  type RestaurantSort,
  type RestaurantWithSummary,
} from '@/features/restaurants/api'
import { formatDistance } from '@/features/restaurants/distance'
import { listGenres } from '@/features/genres/api'
import { useDebounced } from '@/hooks/useDebounced'
import { useGeolocation } from '@/hooks/useGeolocation'
import { LIST_PAGE_SIZE, PRICE_RANGES, type PriceRange } from '@/lib/constants'
import { qk } from '@/lib/queryKeys'
import { ratingTone } from '@/lib/rating'
import { cn } from '@/lib/utils'
import {
  AWARD_CATEGORIES,
  type AwardCategory,
} from '@/features/awards/api'
import { AwardBadge } from '@/components/AwardBadge'
import { FilterChip } from '@/components/FilterChip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ALL = '__all__'

const SORT_OPTIONS: ReadonlyArray<{ value: RestaurantSort; label: string }> = [
  { value: 'recent', label: '新着順' },
  { value: 'rating-high', label: '評価が高い順' },
  { value: 'name', label: '名前順' },
  { value: 'nearby', label: '近い順' },
]

const PRICE_OPTIONS = PRICE_RANGES.map((p) => ({ value: p, label: p }))

const MIN_OVERALL_OPTIONS = [5, 6, 7, 8, 9].map((n) => ({
  value: String(n),
  label: `${n} 以上`,
}))

const AWARD_OPTIONS = AWARD_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
}))

// 並びチップ用の options。FilterChip 側で defaultValue と同じものは除外されるが、
// SORT_OPTIONS は ReadonlyArray なので Option[] に揃えるため map している。
const SORT_OPTIONS_FOR_CHIP = SORT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

/**
 * クイックプリセット：1 タップで複数フィルタを同時適用するショートカット。
 * 適用時、`state` で指定しなかったフィールドは ALL/default にリセット
 * （前回の状態が残らない）。検索クエリだけは予め入力していたものを温存する。
 */
type Preset = {
  id: string
  label: string
  Icon: LucideIcon
  state: {
    genreId?: string
    priceRange?: string
    minOverall?: string
    area?: string
    awardCategory?: string
    sort?: RestaurantSort
  }
  requiresLocation?: boolean
}

const PRESETS: Preset[] = [
  {
    id: 'michelin',
    label: 'ミシュラン',
    Icon: Award,
    state: { awardCategory: 'michelin' },
  },
  {
    id: 'hyakumeiten',
    label: '百名店',
    Icon: Trophy,
    state: { awardCategory: 'tabelog' },
  },
  {
    id: 'high-rated',
    label: '高評価 8.0+',
    Icon: Sparkles,
    state: { minOverall: '8', sort: 'rating-high' },
  },
  {
    id: 'nearby-good',
    label: '近くて高評価',
    Icon: MapPin,
    state: { minOverall: '7', sort: 'nearby' },
    requiresLocation: true,
  },
]

/** 不正な URL クエリ値が入っていたら default に倒す */
function safeParam<T extends string>(
  raw: string | null,
  allowed: ReadonlyArray<T | string>,
  fallback: T
): T {
  return raw && allowed.includes(raw) ? (raw as T) : fallback
}

export function RestaurantList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const geo = useGeolocation()

  // ---- URL から導出する filter state（単一の真の出所） ----
  const query = searchParams.get('q') ?? ''
  const genreId = searchParams.get('genre') ?? ALL
  const area = searchParams.get('area') ?? ALL
  const priceRange = safeParam<string>(searchParams.get('price'), PRICE_RANGES, ALL)
  const minOverall = safeParam<string>(
    searchParams.get('min'),
    MIN_OVERALL_OPTIONS.map((o) => o.value),
    ALL
  )
  const awardCategory = safeParam<string>(
    searchParams.get('award'),
    AWARD_CATEGORIES.map((c) => c.value),
    ALL
  )
  const sort = safeParam<RestaurantSort>(
    searchParams.get('sort'),
    SORT_OPTIONS.map((o) => o.value),
    'recent'
  )

  // limit はページング状態。共有 URL に含めても意味が薄いので URL 同期しない。
  const [limit, setLimit] = useState(LIST_PAGE_SIZE)

  const debouncedQuery = useDebounced(query, 300)

  /** 1 つの URL クエリパラメータだけ更新するヘルパー（同時にページもリセット） */
  const updateParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === defaultValue || value === '') next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true }
      )
      setLimit(LIST_PAGE_SIZE)
    },
    [setSearchParams, setLimit]
  )

  /** 複数フィルタをまとめて差し替える（プリセット適用 / 全クリア用）。
   *  指定外 / default 値は URL に書かない（URL を綺麗に保つ） */
  const replaceParams = useCallback(
    (next: {
      q?: string
      genre?: string
      area?: string
      price?: string
      min?: string
      award?: string
      sort?: RestaurantSort
    }) => {
      const params = new URLSearchParams()
      if (next.q) params.set('q', next.q)
      if (next.genre && next.genre !== ALL) params.set('genre', next.genre)
      if (next.area && next.area !== ALL) params.set('area', next.area)
      if (next.price && next.price !== ALL) params.set('price', next.price)
      if (next.min && next.min !== ALL) params.set('min', next.min)
      if (next.award && next.award !== ALL) params.set('award', next.award)
      if (next.sort && next.sort !== 'recent') params.set('sort', next.sort)
      setSearchParams(params, { replace: true })
      setLimit(LIST_PAGE_SIZE)
    },
    [setSearchParams]
  )

  const handleNearbyClear = () => {
    geo.clear()
    if (sort === 'nearby') updateParam('sort', 'recent', 'recent')
  }

  /** 並びを「近い順」にしようとしたら位置情報を要求 */
  const handleSortChange = async (v: string) => {
    const next = v as RestaurantSort
    if (next === 'nearby' && !geo.coords) {
      const coords = await geo.request()
      if (!coords) return
    }
    updateParam('sort', next, 'recent')
  }

  const handleGeolocationToggle = async () => {
    if (geo.status === 'success') {
      handleNearbyClear()
      return
    }
    if (geo.status === 'loading') return
    await geo.request()
  }

  const applyPreset = async (preset: Preset) => {
    if (preset.requiresLocation && !geo.coords) {
      const coords = await geo.request()
      if (!coords) return
    }
    replaceParams({
      q: query, // 検索文字列だけは温存（"渋谷の" + ミシュラン、のような複合意図に応える）
      genre: preset.state.genreId,
      area: preset.state.area,
      price: preset.state.priceRange,
      min: preset.state.minOverall,
      award: preset.state.awardCategory,
      sort: preset.state.sort,
    })
  }

  const clearAll = () => {
    replaceParams({})
  }

  // ---- API ----
  // limit + 1 取って超過分の有無で hasMore を判定。クライアント側 filter
  // （minOverall / awardCategory / rating-high ソート等）でちょうど limit に
  // 切れた時の「もっと見るを押しても 0 件追加」を防ぐ。
  const filters: RestaurantFilters = useMemo(
    () => ({
      query: debouncedQuery.trim() || undefined,
      genreId: genreId === ALL ? undefined : genreId,
      priceRange: priceRange === ALL ? undefined : (priceRange as PriceRange),
      minOverall: minOverall === ALL ? undefined : Number(minOverall),
      area: area === ALL ? undefined : area,
      awardCategory:
        awardCategory === ALL ? undefined : (awardCategory as AwardCategory),
      userLocation: geo.coords ?? undefined,
      sort,
      limit: limit + 1,
    }),
    [
      debouncedQuery,
      genreId,
      priceRange,
      minOverall,
      area,
      awardCategory,
      geo.coords,
      sort,
      limit,
    ]
  )

  const restaurantsQuery = useQuery({
    queryKey: qk.restaurants.list(filters),
    queryFn: () => listRestaurants(filters),
  })

  const genresQuery = useQuery({ queryKey: qk.genres.all, queryFn: listGenres })
  const areasQuery = useQuery({
    queryKey: qk.restaurants.areas,
    queryFn: listRestaurantAreas,
  })

  const fetched = restaurantsQuery.data ?? []
  const restaurants = fetched.slice(0, limit)
  const hasMore = fetched.length > limit

  // ---- chip options ----
  const genreOptions = useMemo(
    () => (genresQuery.data ?? []).map((g) => ({ value: g.id, label: g.name })),
    [genresQuery.data]
  )
  const areaOptions = useMemo(
    () => (areasQuery.data ?? []).map((a) => ({ value: a, label: a })),
    [areasQuery.data]
  )

  const activePresetId = useMemo(() => {
    for (const p of PRESETS) {
      if (
        (p.state.genreId ?? ALL) === genreId &&
        (p.state.priceRange ?? ALL) === priceRange &&
        (p.state.minOverall ?? ALL) === minOverall &&
        (p.state.area ?? ALL) === area &&
        (p.state.awardCategory ?? ALL) === awardCategory &&
        (p.state.sort ?? 'recent') === sort
      ) {
        return p.id
      }
    }
    return null
  }, [genreId, priceRange, minOverall, area, awardCategory, sort])

  const hasAnyFilter =
    query.trim().length > 0 ||
    genreId !== ALL ||
    area !== ALL ||
    priceRange !== ALL ||
    minOverall !== ALL ||
    awardCategory !== ALL ||
    sort !== 'recent'

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">店舗一覧</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:text-base">
            <span>
              {restaurants.length} 件{hasMore ? '（さらに表示可）' : ''}
            </span>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2.5 text-xs font-medium text-primary hover:bg-accent"
              >
                すべてクリア
              </button>
            )}
          </div>
        </div>
        <Button asChild size="lg" className="hidden md:inline-flex">
          <Link to="/restaurants/new">
            <Plus className="h-4 w-4" /> 店を登録
          </Link>
        </Button>
      </header>

      {/* 検索 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="店名で検索"
          aria-label="店名で検索"
          value={query}
          onChange={(e) => updateParam('q', e.target.value, '')}
          className="pl-9"
        />
      </div>

      {/* プリセット chips（モバイルは横スクロール、デスクトップは wrap） */}
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:flex-wrap md:overflow-visible"
        role="group"
        aria-label="クイックフィルタ"
      >
        {PRESETS.map((p) => {
          const active = activePresetId === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <p.Icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          )
        })}
      </div>

      {/* フィルタ chip bar（モバイルは横スクロール、デスクトップは wrap） */}
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:flex-wrap md:overflow-visible"
        role="group"
        aria-label="フィルタ"
      >
        <FilterChip
          label="ジャンル"
          value={genreId}
          defaultValue={ALL}
          onChange={(v) => updateParam('genre', v, ALL)}
          options={genreOptions}
        />
        <FilterChip
          label="エリア"
          value={area}
          defaultValue={ALL}
          onChange={(v) => updateParam('area', v, ALL)}
          options={areaOptions}
        />
        <FilterChip
          label="価格"
          value={priceRange}
          defaultValue={ALL}
          onChange={(v) => updateParam('price', v, ALL)}
          options={PRICE_OPTIONS}
        />
        <FilterChip
          label="総合"
          value={minOverall}
          defaultValue={ALL}
          onChange={(v) => updateParam('min', v, ALL)}
          options={MIN_OVERALL_OPTIONS}
        />
        <FilterChip
          label="称号"
          value={awardCategory}
          defaultValue={ALL}
          onChange={(v) => updateParam('award', v, ALL)}
          options={AWARD_OPTIONS}
        />
        <FilterChip
          label="並び"
          value={sort}
          defaultValue="recent"
          onChange={handleSortChange}
          options={SORT_OPTIONS_FOR_CHIP}
          allLabel="新着順"
        />
        <GeolocationChip
          status={geo.status}
          error={geo.error}
          onToggle={handleGeolocationToggle}
        />
      </div>

      {/* 一覧本体 */}
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
          {hasAnyFilter ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
              すべてクリア
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/restaurants/new">
                <Plus className="h-4 w-4" /> 店を登録する
              </Link>
            </Button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {restaurants.map((r) => (
          <li key={r.id}>
            <RestaurantRow restaurant={r} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="pt-2 text-center">
          <Button variant="outline" onClick={() => setLimit((n) => n + LIST_PAGE_SIZE)}>
            もっと見る
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * 位置情報トグルチップ。chip bar の他のフィルタと並ぶ見た目に揃える。
 * - idle: outline / 「現在地」
 * - loading: outline / 「位置情報取得中...」
 * - success: primary / 「現在地: 使用中」 ✕
 * - error: destructive 系 / エラーメッセージは title に格納
 */
function GeolocationChip({
  status,
  error,
  onToggle,
}: {
  status: ReturnType<typeof useGeolocation>['status']
  error: string | null
  onToggle: () => void
}) {
  const isActive = status === 'success'
  const label =
    status === 'loading'
      ? '位置情報取得中...'
      : isActive
        ? '現在地: 使用中'
        : '現在地'
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={status === 'loading'}
      title={status === 'error' && error ? `位置情報エラー: ${error}` : undefined}
      aria-pressed={isActive}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        isActive
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : status === 'error'
            ? 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'
            : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <MapPin className="h-3.5 w-3.5" />
      {label}
      {isActive && <X className="h-3 w-3 opacity-80" />}
    </button>
  )
}

/**
 * コンパクト一覧の 1 行。評価列を固定幅で右寄せにし、行を跨いで縦に揃えることで
 * カード表示よりも比較・スキャンしやすくする狙い。
 * モバイルの縦長スクロールでも 1 列で詰めて表示できる。
 */
function RestaurantRow({ restaurant: r }: { restaurant: RestaurantWithSummary }) {
  const avg = r.summary?.avg_overall
  const count = r.summary?.rating_count ?? 0
  const visibleAwards = r.awards.slice(0, 3)
  const hiddenAwardCount = Math.max(0, r.awards.length - visibleAwards.length)

  // 「ジャンル · エリア · 価格 · 距離」を中黒で 1 行に。エリア/距離は無ければ skip。
  const meta: string[] = [r.genre?.name ?? '未分類', r.price_range]
  if (r.area) meta.splice(1, 0, r.area)
  if (r.distanceKm != null) meta.push(formatDistance(r.distanceKm))

  return (
    <Link to={`/restaurants/${r.id}`} className="group block">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors group-hover:border-primary/50 group-hover:bg-accent/40">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold md:text-base">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {meta.join(' · ')}
          </p>
          {visibleAwards.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {visibleAwards.map((a) => (
                <AwardBadge
                  key={a.id}
                  size="sm"
                  name={a.award?.name ?? a.custom_label ?? '(不明)'}
                  category={a.award?.category ?? 'other'}
                  year={a.year}
                />
              ))}
              {hiddenAwardCount > 0 && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  +{hiddenAwardCount}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="w-14 shrink-0 text-center">
          <p
            className={cn(
              'text-2xl font-bold leading-none tabular-nums',
              avg != null ? ratingTone(avg) : 'text-muted-foreground'
            )}
          >
            {avg != null ? avg.toFixed(1) : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {count > 0 ? `${count} 件` : '未評価'}
          </p>
        </div>
      </div>
    </Link>
  )
}

