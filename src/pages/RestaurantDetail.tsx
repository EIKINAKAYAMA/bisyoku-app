import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ExternalLink, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { getRestaurant } from '@/features/restaurants/api'
import { listVisitsForRestaurant } from '@/features/visits/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RATING_AXES } from '@/lib/constants'

export function RestaurantDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const restaurantQuery = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const visitsQuery = useQuery({
    queryKey: ['visits', 'restaurant', id],
    queryFn: () => listVisitsForRestaurant(id),
    enabled: !!id,
  })

  if (restaurantQuery.isLoading) {
    return <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
  }
  if (!restaurantQuery.data) {
    return <p className="py-12 text-center text-muted-foreground">店舗が見つかりません</p>
  }

  const r = restaurantQuery.data

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Button>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{r.name}</h1>
        <p className="text-sm text-muted-foreground">
          {r.genre?.name ?? '未分類'} ・ {r.price_range}
        </p>
        {r.link && (
          <a
            href={r.link}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            店舗ページ <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </header>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">平均評価</h2>
          <div className="grid grid-cols-5 gap-2 text-center">
            {RATING_AXES.map((axis) => {
              const v = r.summary?.[`avg_${axis.key}` as const]
              return (
                <div key={axis.key}>
                  <p className="text-xs text-muted-foreground">{axis.label}</p>
                  <p className="text-lg font-bold">
                    {typeof v === 'number' ? v.toFixed(1) : '—'}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {r.summary?.rating_count ?? 0} 件の評価
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">訪問記録</h2>
        <Button asChild size="sm">
          <Link to={`/restaurants/${r.id}/visits/new`}>
            <Plus className="h-4 w-4" /> 訪問を追加
          </Link>
        </Button>
      </div>

      {visitsQuery.isLoading && (
        <p className="py-8 text-center text-muted-foreground">読み込み中...</p>
      )}
      {visitsQuery.data && visitsQuery.data.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          まだ訪問記録がありません。
        </p>
      )}

      <ul className="space-y-2">
        {visitsQuery.data?.map((v) => (
          <li key={v.id}>
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <Link
                    to={`/users/${v.user?.id}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {v.user?.display_name ?? '不明なユーザー'}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {v.visit_date ? format(new Date(v.visit_date), 'yyyy/MM/dd') : '日付未記入'}
                  </p>
                </div>

                {v.rating && (
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {RATING_AXES.map((axis) => (
                      <div key={axis.key}>
                        <p className="text-[10px] text-muted-foreground">{axis.label}</p>
                        <p className="text-sm font-bold">{v.rating?.[axis.key]}</p>
                      </div>
                    ))}
                  </div>
                )}

                {(v.order_content || v.payment_amount != null) && (
                  <div className="space-y-1 text-sm">
                    {v.order_content && (
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {v.order_content}
                      </p>
                    )}
                    {v.payment_amount != null && (
                      <p className="text-muted-foreground">
                        支払い：{v.payment_amount.toLocaleString()} 円
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
