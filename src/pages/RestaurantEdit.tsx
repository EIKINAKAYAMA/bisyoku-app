import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  getRestaurant,
  updateRestaurant,
  type CreateRestaurantInput,
} from '@/features/restaurants/api'
import {
  RestaurantForm,
  type RestaurantFormInitial,
} from '@/features/restaurants/RestaurantForm'
import { BackButton } from '@/components/BackButton'
import { qk } from '@/lib/queryKeys'

export function RestaurantEdit() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const restaurantQuery = useQuery({
    queryKey: qk.restaurants.detail(id),
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const updateMut = useMutation({
    mutationFn: (input: CreateRestaurantInput) => updateRestaurant(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.restaurants.detail(id) })
      queryClient.invalidateQueries({ queryKey: qk.restaurants.all })
      navigate(`/restaurants/${id}`, { replace: true })
    },
  })

  if (restaurantQuery.isLoading) {
    return <p className="py-12 text-center text-muted-foreground">読み込み中...</p>
  }
  if (!restaurantQuery.data) {
    return <p className="py-12 text-center text-muted-foreground">店舗が見つかりません</p>
  }
  if (restaurantQuery.data.created_by !== user?.id) {
    return (
      <p className="py-12 text-center text-destructive">
        登録した本人だけが編集できます
      </p>
    )
  }

  const initial: RestaurantFormInitial = {
    name: restaurantQuery.data.name,
    link: restaurantQuery.data.link,
    genre_id: restaurantQuery.data.genre_id,
    price_range: restaurantQuery.data.price_range,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">店舗を編集</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {restaurantQuery.data.name}
        </p>
      </header>

      <RestaurantForm
        initial={initial}
        onSubmit={async (input) => {
          await updateMut.mutateAsync(input)
        }}
        submitLabel="保存"
      />
    </div>
  )
}
