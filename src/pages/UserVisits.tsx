import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { deleteVisit, listVisitsForUser } from '@/features/visits/api'
import { getProfile } from '@/features/users/api'
import { useAuth } from '@/features/auth/AuthProvider'
import { VisitItem } from '@/features/visits/VisitItem'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 30

export function UserVisits() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isOwner = id === user?.id
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id),
    enabled: !!id,
  })

  const visitsQuery = useQuery({
    queryKey: ['visits', 'user', id, limit],
    queryFn: () => listVisitsForUser(id, { limit }),
    enabled: !!id,
  })

  const deleteMut = useMutation({
    mutationFn: (visitId: string) => deleteVisit(visitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'user', id] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      setVisitToDelete(null)
    },
  })

  const visits = visitsQuery.data ?? []
  const hasMore = visits.length === limit

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Button>

      <header className="flex items-center gap-4">
        <Avatar
          src={profileQuery.data?.avatar_url ?? null}
          fallback={profileQuery.data?.display_name ?? '?'}
          alt={profileQuery.data?.display_name}
          className="h-14 w-14 shadow-sm ring-2 ring-primary/20 md:h-16 md:w-16"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
            {profileQuery.data?.display_name ?? '...'} さんの訪問履歴
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            {visits.length} 件{hasMore ? '（さらに表示可）' : ''}
          </p>
        </div>
      </header>

      {visitsQuery.isLoading && (
        <p className="py-8 text-center text-muted-foreground">読み込み中...</p>
      )}
      {!visitsQuery.isLoading && visits.length === 0 && (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          まだ訪問記録がありません。
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visits.map((v) => (
          <li key={v.id}>
            <VisitItem
              visit={v}
              primary={{
                kind: 'restaurant',
                restaurant: v.restaurant,
                genre: v.restaurant?.genre?.name ?? null,
                priceRange: v.restaurant?.price_range ?? null,
              }}
              isOwner={isOwner}
              editTo={
                v.restaurant?.id ? `/restaurants/${v.restaurant.id}/visits/${v.id}/edit` : undefined
              }
              onDelete={isOwner ? () => setVisitToDelete(v.id) : undefined}
              deleting={deleteMut.isPending}
            />
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

      <ConfirmDialog
        open={visitToDelete != null}
        onOpenChange={(open) => !open && setVisitToDelete(null)}
        title="訪問記録を削除しますか？"
        description="この訪問記録と評価・コメントを削除します。この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        busy={deleteMut.isPending}
        onConfirm={() => {
          if (visitToDelete) deleteMut.mutate(visitToDelete)
        }}
      />
    </div>
  )
}
