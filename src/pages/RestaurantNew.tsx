import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { createRestaurant, type CreateRestaurantInput } from '@/features/restaurants/api'
import { RestaurantForm } from '@/features/restaurants/RestaurantForm'
import { BackButton } from '@/components/BackButton'
import { qk } from '@/lib/queryKeys'

export function RestaurantNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const createMut = useMutation({
    mutationFn: (input: CreateRestaurantInput) => {
      if (!user) throw new Error('未ログイン')
      return createRestaurant(input, user.id)
    },
    onSuccess: (restaurant) => {
      queryClient.invalidateQueries({ queryKey: qk.restaurants.all })
      navigate(`/restaurants/${restaurant.id}`, { replace: true })
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton fallback="/" />
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">店舗を登録</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          まずは店舗だけ登録できます。訪問記録・評価は後から追加できます。
        </p>
      </header>

      <RestaurantForm
        onSubmit={async (input) => {
          await createMut.mutateAsync(input)
        }}
        submitLabel="登録する"
      />
    </div>
  )
}
