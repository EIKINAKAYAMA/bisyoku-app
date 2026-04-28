import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { getRestaurant } from '@/features/restaurants/api'
import { createVisit, type VisitInput } from '@/features/visits/api'
import { VisitForm } from '@/features/visits/VisitForm'
import { Button } from '@/components/ui/button'

export function VisitNew() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const restaurantQuery = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const createMut = useMutation({
    mutationFn: (input: VisitInput) => {
      if (!user) throw new Error('未ログイン')
      return createVisit({ ...input, restaurant_id: id }, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      navigate(`/restaurants/${id}`, { replace: true })
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Button>
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
