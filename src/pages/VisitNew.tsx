import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { getRestaurant } from '@/features/restaurants/api'
import { createVisit, type VisitInput } from '@/features/visits/api'
import { VisitForm } from '@/features/visits/VisitForm'
import { BackButton } from '@/components/BackButton'
import { invalidateAfterVisitChange, qk } from '@/lib/queryKeys'

export function VisitNew() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const restaurantQuery = useQuery({
    queryKey: qk.restaurants.detail(id),
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const createMut = useMutation({
    mutationFn: (input: VisitInput) => {
      if (!user) throw new Error('未ログイン')
      return createVisit({ ...input, restaurant_id: id }, user.id)
    },
    onSuccess: () => {
      invalidateAfterVisitChange(queryClient, id)
      navigate(`/restaurants/${id}`, { replace: true })
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">訪問を追加</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {restaurantQuery.data?.name ?? '...'}
        </p>
      </header>

      <VisitForm
        onSubmit={async (input) => {
          await createMut.mutateAsync(input)
        }}
        submitLabel="保存"
      />
    </div>
  )
}
