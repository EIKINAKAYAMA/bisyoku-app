import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { getRestaurant } from '@/features/restaurants/api'
import { getVisit, updateVisit, type VisitInput } from '@/features/visits/api'
import { VisitForm, type VisitFormInitial } from '@/features/visits/VisitForm'
import { BackButton } from '@/components/BackButton'
import { invalidateAfterVisitChange, qk } from '@/lib/queryKeys'

export function VisitEdit() {
  const { id = '', visitId = '' } = useParams<{ id: string; visitId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const restaurantQuery = useQuery({
    queryKey: qk.restaurants.detail(id),
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const visitQuery = useQuery({
    queryKey: qk.visits.detail(visitId),
    queryFn: () => getVisit(visitId),
    enabled: !!visitId,
  })

  const updateMut = useMutation({
    mutationFn: (input: VisitInput) => updateVisit(visitId, input),
    onSuccess: () => {
      invalidateAfterVisitChange(queryClient, id)
      queryClient.invalidateQueries({ queryKey: qk.visits.detail(visitId) })
      navigate(`/restaurants/${id}`, { replace: true })
    },
  })

  if (visitQuery.isLoading) {
    return <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
  }
  if (!visitQuery.data) {
    return <p className="py-12 text-center text-muted-foreground">訪問記録が見つかりません</p>
  }

  // 自分の訪問かチェック
  if (visitQuery.data.user_id !== user?.id) {
    return (
      <p className="py-12 text-center text-destructive">
        他のユーザーの訪問記録は編集できません
      </p>
    )
  }

  const initial: VisitFormInitial = {
    visit_date: visitQuery.data.visit_date,
    order_content: visitQuery.data.order_content,
    payment_amount: visitQuery.data.payment_amount,
    comment: visitQuery.data.comment,
    rating: visitQuery.data.rating
      ? {
          overall: visitQuery.data.rating.overall,
          food: visitQuery.data.rating.food,
          service: visitQuery.data.rating.service,
          atmosphere: visitQuery.data.rating.atmosphere,
          cost_performance: visitQuery.data.rating.cost_performance,
        }
      : null,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton fallback={`/restaurants/${id}`} />
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">訪問を編集</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {restaurantQuery.data?.name ?? '...'}
        </p>
      </header>

      <VisitForm
        initial={initial}
        onSubmit={async (input) => {
          await updateMut.mutateAsync(input)
        }}
        submitLabel="保存して反映"
      />
    </div>
  )
}
