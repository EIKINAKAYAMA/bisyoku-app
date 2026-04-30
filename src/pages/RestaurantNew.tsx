import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { createRestaurant, type CreateRestaurantInput } from '@/features/restaurants/api'
import { setAwardsForRestaurant, type AwardEntryInput } from '@/features/awards/api'
import { RestaurantForm } from '@/features/restaurants/RestaurantForm'
import { BackButton } from '@/components/BackButton'
import { qk } from '@/lib/queryKeys'

type CreateArgs = { input: CreateRestaurantInput; awards: AwardEntryInput[] }

export function RestaurantNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const createMut = useMutation({
    mutationFn: async ({ input, awards }: CreateArgs) => {
      if (!user) throw new Error('未ログイン')
      const restaurant = await createRestaurant(input, user.id)
      if (awards.length > 0) {
        try {
          await setAwardsForRestaurant(restaurant.id, awards)
        } catch (e) {
          // 店舗は既に作成済み。称号失敗を mutation エラーに昇格させると、
          // ユーザーが「保存」を再度押した時に店舗が二重作成されてしまう
          // （restaurants.name に UNIQUE 制約は無いため）。
          // ログだけ残し、ナビゲーションは継続。称号は詳細画面の編集から再設定してもらう。
          console.error(
            '[createRestaurant] awards save failed (restaurant was created):',
            e
          )
        }
      }
      return restaurant
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
        onSubmit={async (input, awards) => {
          await createMut.mutateAsync({ input, awards })
        }}
        submitLabel="登録する"
      />
    </div>
  )
}
