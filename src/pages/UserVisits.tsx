import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { listVisitsForUser } from '@/features/visits/api'
import { getProfile } from '@/features/users/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RATING_AXES } from '@/lib/constants'

export function UserVisits() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const profileQuery = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id),
    enabled: !!id,
  })

  const visitsQuery = useQuery({
    queryKey: ['visits', 'user', id],
    queryFn: () => listVisitsForUser(id),
    enabled: !!id,
  })

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Button>

      <header>
        <h1 className="text-xl font-bold">
          {profileQuery.data?.display_name ?? '...'} さんの訪問履歴
        </h1>
        <p className="text-sm text-muted-foreground">
          {visitsQuery.data?.length ?? 0} 件
        </p>
      </header>

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
                    to={`/restaurants/${v.restaurant?.id}`}
                    className="font-semibold hover:underline"
                  >
                    {v.restaurant?.name ?? '不明な店舗'}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {v.visit_date ? format(new Date(v.visit_date), 'yyyy/MM/dd') : '日付未記入'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.restaurant?.genre?.name ?? '未分類'} ・ {v.restaurant?.price_range}
                </p>

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
