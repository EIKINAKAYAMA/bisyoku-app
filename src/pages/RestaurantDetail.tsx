import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, MapPin, Pencil, Plus, Trash2, Utensils } from 'lucide-react'
import {
  countVisitsForRestaurant,
  deleteRestaurant,
  getRestaurant,
} from '@/features/restaurants/api'
import { deleteVisit, listVisitsForRestaurant } from '@/features/visits/api'
import { useAuth } from '@/features/auth/AuthProvider'
import { VisitItem } from '@/features/visits/VisitItem'
import { BackButton } from '@/components/BackButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RestaurantMap } from '@/components/RestaurantMap'
import { extractCoordsFromMapsUrl } from '@/features/restaurants/mapsUrl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LIST_PAGE_SIZE, RATING_AXES } from '@/lib/constants'
import { invalidateAfterVisitChange, qk } from '@/lib/queryKeys'
import { ratingTone } from '@/lib/rating'

export function RestaurantDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [limit, setLimit] = useState(LIST_PAGE_SIZE)
  const [restaurantConfirmOpen, setRestaurantConfirmOpen] = useState(false)
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null)

  const restaurantQuery = useQuery({
    queryKey: qk.restaurants.detail(id),
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const visitsQuery = useQuery({
    queryKey: qk.visits.forRestaurantPaged(id, limit),
    queryFn: () => listVisitsForRestaurant(id, { limit }),
    enabled: !!id,
  })

  // 訪問件数（削除確認に表示する）
  const visitCountQuery = useQuery({
    queryKey: qk.visits.countForRestaurant(id),
    queryFn: () => countVisitsForRestaurant(id),
    enabled: !!id,
  })

  const deleteVisitMut = useMutation({
    mutationFn: (visitId: string) => deleteVisit(visitId),
    onSuccess: () => {
      invalidateAfterVisitChange(queryClient, id)
      setVisitToDelete(null)
    },
  })

  const deleteRestaurantMut = useMutation({
    mutationFn: () => deleteRestaurant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.restaurants.all })
      queryClient.invalidateQueries({ queryKey: qk.visits.allForUsers })
      navigate('/', { replace: true })
    },
  })

  if (restaurantQuery.isLoading) {
    return <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
  }
  if (!restaurantQuery.data) {
    return <p className="py-12 text-center text-muted-foreground">店舗が見つかりません</p>
  }

  const r = restaurantQuery.data
  const visits = visitsQuery.data ?? []
  const hasMore = visits.length === limit
  const visitCount = visitCountQuery.data ?? 0
  // 店舗削除は「訪問記録 0 件のとき招待ユーザー全員可」（DB 側 RLS と一致）。
  // 1 件でも残っていれば他人のデータ巻き込み防止のため不可。
  // visitCount のロード完了を待ってから判定する（ロード中は false 扱いで誤クリックを防ぐ）。
  const canDeleteRestaurant = visitCountQuery.isSuccess && visitCount === 0
  // google_maps_url から座標が拾えれば地図を出す。短縮 URL（maps.app.goo.gl/*）等で
  // 拾えない場合は地図セクション自体を非表示にする（ボタンは動く）。
  const mapCoords = extractCoordsFromMapsUrl(r.google_maps_url)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <header className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight md:text-4xl">{r.name}</h1>
              <div className="flex shrink-0 items-center gap-1">
                {/* 店舗マスタは共有データなので、編集も削除も招待ユーザー全員に開放。
                    削除は他人の記録巻き込み防止のため「訪問記録 0 件」のときのみ可。 */}
                <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                  <Link to={`/restaurants/${r.id}/edit`} aria-label="店舗を編集">
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setRestaurantConfirmOpen(true)}
                  disabled={!canDeleteRestaurant}
                  aria-label={
                    canDeleteRestaurant
                      ? '店舗を削除'
                      : '訪問記録があるため削除できません'
                  }
                  title={
                    canDeleteRestaurant
                      ? undefined
                      : '訪問記録があるため削除できません'
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                {r.genre?.name ?? '未分類'}
              </span>
              <span className="rounded-full bg-accent/30 px-3 py-1 font-medium text-accent-foreground">
                {r.price_range}
              </span>
            </div>
          </header>

          <ExternalLinks
            link={r.link}
            name={r.name}
            googleMapsUrl={r.google_maps_url}
            tabelogUrl={r.tabelog_url}
          />

          {mapCoords && <RestaurantMap lat={mapCoords.lat} lng={mapCoords.lng} />}

          <Card className="overflow-hidden border-2">
            <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-4">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">平均評価</h2>
              <div className="grid grid-cols-5 gap-2 text-center">
                {RATING_AXES.map((axis) => {
                  const v = r.summary?.[`avg_${axis.key}` as const]
                  const tone = typeof v === 'number' ? ratingTone(v) : null
                  return (
                    <div key={axis.key}>
                      <p className="text-xs text-muted-foreground">{axis.label}</p>
                      <p className={`mt-1 text-xl font-bold tabular-nums md:text-2xl ${tone ?? ''}`}>
                        {typeof v === 'number' ? v.toFixed(1) : '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 border-t pt-2 text-center text-xs text-muted-foreground">
                {r.summary?.rating_count ?? 0} 件の評価
              </p>
            </div>
          </Card>

          <Button asChild size="lg" className="w-full">
            <Link to={`/restaurants/${r.id}/visits/new`}>
              <Plus className="h-4 w-4" /> 訪問・評価を追加
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">訪問記録</h2>

          {visitsQuery.isLoading && (
            <p className="py-8 text-center text-muted-foreground">読み込み中...</p>
          )}
          {visits.length === 0 && !visitsQuery.isLoading && (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              まだ訪問記録がありません。最初の 1 件を追加しましょう。
            </div>
          )}

          <ul className="space-y-3">
            {visits.map((v) => (
              <li key={v.id}>
                <VisitItem
                  visit={v}
                  primary={{ kind: 'user', user: v.user }}
                  isOwner={v.user_id === user?.id}
                  editTo={`/restaurants/${id}/visits/${v.id}/edit`}
                  onDelete={() => setVisitToDelete(v.id)}
                  deleting={deleteVisitMut.isPending}
                />
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
      </div>

      {/* 店舗削除：訪問記録 0 件のときのみボタンが押せる前提なので cascade 警告は不要 */}
      <ConfirmDialog
        open={restaurantConfirmOpen}
        onOpenChange={(open) => {
          setRestaurantConfirmOpen(open)
          // 閉じたタイミングでエラー表示もリセットする（次回開いたときに残らないように）
          if (!open) deleteRestaurantMut.reset()
        }}
        title="店舗を削除しますか？"
        description={
          <>
            <p className="font-medium text-foreground">「{r.name}」を削除します。</p>
            <p className="mt-2">この操作は取り消せません。</p>
            {deleteRestaurantMut.isError && (
              <p className="mt-3 rounded-md bg-destructive/10 p-3 text-destructive">
                {(deleteRestaurantMut.error as Error).message}
              </p>
            )}
          </>
        }
        confirmLabel="削除する"
        variant="destructive"
        busy={deleteRestaurantMut.isPending}
        onConfirm={() => deleteRestaurantMut.mutate()}
      />

      {/* 訪問削除 */}
      <ConfirmDialog
        open={visitToDelete != null}
        onOpenChange={(open) => !open && setVisitToDelete(null)}
        title="訪問記録を削除しますか？"
        description="この訪問記録と評価・コメントを削除します。この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        busy={deleteVisitMut.isPending}
        onConfirm={() => {
          if (visitToDelete) deleteVisitMut.mutate(visitToDelete)
        }}
      />
    </div>
  )
}

function ExternalLinks({
  link,
  name,
  googleMapsUrl,
  tabelogUrl,
}: {
  link: string | null
  name: string
  googleMapsUrl: string | null
  tabelogUrl: string | null
}) {
  // 直リンクが設定されていればそれをそのまま開く（店舗にピンポイントで飛ぶ）。
  // 未設定の場合のみ店名でのテキスト検索にフォールバック。
  const mapsHref =
    googleMapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
  const tabelogHref =
    tabelogUrl ?? `https://tabelog.com/rstLst/?sw=${encodeURIComponent(name)}`

  // 直リンクではない（フォールバックの検索）場合はラベルでそれと分かるようにする。
  const mapsLabel = googleMapsUrl ? 'Google Maps' : 'Google Maps で検索'
  const tabelogLabel = tabelogUrl ? '食べログ' : '食べログで検索'

  return (
    <div className="flex flex-wrap gap-2">
      {link && (
        <Button asChild variant="outline" size="sm">
          <a href={link} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="h-3.5 w-3.5" /> 店舗ページ
          </a>
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={mapsHref} target="_blank" rel="noreferrer noopener">
          <MapPin className="h-3.5 w-3.5" /> {mapsLabel}
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={tabelogHref} target="_blank" rel="noreferrer noopener">
          <Utensils className="h-3.5 w-3.5" /> {tabelogLabel}
        </a>
      </Button>
    </div>
  )
}
