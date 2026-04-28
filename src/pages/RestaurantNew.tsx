import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { createRestaurant } from '@/features/restaurants/api'
import { PRICE_RANGES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GenreField } from '@/components/GenreField'

const schema = z.object({
  name: z.string().min(1, '店名を入力してください').max(120),
  link: z
    .string()
    .max(500)
    .refine(
      (v) => !v || /^https?:\/\//.test(v),
      'http(s):// から始まる URL を入力してください'
    )
    .optional()
    .or(z.literal('')),
  genre_id: z.string().min(1, 'ジャンルを選択してください'),
  price_range: z.enum(PRICE_RANGES),
})
type FormValues = z.infer<typeof schema>

export function RestaurantNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [topError, setTopError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', link: '', genre_id: '', price_range: '〜2000' },
  })

  const createMut = useMutation({
    mutationFn: (values: FormValues) => {
      if (!user) throw new Error('未ログイン')
      return createRestaurant(
        {
          name: values.name,
          link: values.link ? values.link : null,
          genre_id: values.genre_id,
          price_range: values.price_range,
        },
        user.id
      )
    },
    onSuccess: (restaurant) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      navigate(`/restaurants/${restaurant.id}`, { replace: true })
    },
    onError: (e) => setTopError((e as Error).message),
  })

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Button>
      <h1 className="text-xl font-bold">店舗を登録</h1>
      <p className="text-sm text-muted-foreground">
        まずは店舗だけ登録できます。訪問記録・評価は後から追加できます。
      </p>

      <form
        onSubmit={form.handleSubmit((v) => createMut.mutate(v))}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">店名</Label>
          <Input id="name" {...form.register('name')} />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>ジャンル</Label>
          <GenreField
            value={form.watch('genre_id') || undefined}
            onChange={(id) => form.setValue('genre_id', id, { shouldValidate: true })}
          />
          {form.formState.errors.genre_id && (
            <p className="text-sm text-destructive">
              {form.formState.errors.genre_id.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>価格帯</Label>
          <Select
            value={form.watch('price_range')}
            onValueChange={(v) =>
              form.setValue('price_range', v as FormValues['price_range'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_RANGES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="link">店のリンク（任意）</Label>
          <Input id="link" inputMode="url" placeholder="https://..." {...form.register('link')} />
          {form.formState.errors.link && (
            <p className="text-sm text-destructive">
              {form.formState.errors.link.message}
            </p>
          )}
        </div>

        {topError && <p className="text-sm text-destructive">{topError}</p>}

        <Button type="submit" className="w-full" disabled={createMut.isPending}>
          {createMut.isPending ? '登録中...' : '登録する'}
        </Button>
      </form>
    </div>
  )
}
