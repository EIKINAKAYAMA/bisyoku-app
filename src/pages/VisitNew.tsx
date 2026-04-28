import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { getRestaurant } from '@/features/restaurants/api'
import { createVisit } from '@/features/visits/api'
import { RATING_AXES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const ratingNum = z
  .number({ invalid_type_error: '数値を入力' })
  .int()
  .min(1, '1〜10')
  .max(10, '1〜10')

const schema = z.object({
  visit_date: z.string().optional().or(z.literal('')),
  order_content: z.string().max(2000).optional().or(z.literal('')),
  payment_amount: z
    .preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
      z.union([z.null(), z.number().int().min(0)])
    )
    .optional(),
  include_rating: z.boolean(),
  overall: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
  food: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
  service: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
  atmosphere: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
  cost_performance: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
})
.superRefine((data, ctx) => {
  if (data.include_rating) {
    for (const axis of RATING_AXES) {
      if (data[axis.key] == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [axis.key],
          message: '評価を入れてください',
        })
      }
    }
  }
})

type FormValues = z.infer<typeof schema>

export function VisitNew() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [topError, setTopError] = useState<string | null>(null)

  const restaurantQuery = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id),
    enabled: !!id,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visit_date: '',
      order_content: '',
      payment_amount: null,
      include_rating: true,
      overall: undefined,
      food: undefined,
      service: undefined,
      atmosphere: undefined,
      cost_performance: undefined,
    },
  })

  const includeRating = form.watch('include_rating')

  const createMut = useMutation({
    mutationFn: (values: FormValues) => {
      if (!user) throw new Error('未ログイン')
      return createVisit(
        {
          restaurant_id: id,
          visit_date: values.visit_date ? values.visit_date : null,
          order_content: values.order_content ? values.order_content : null,
          payment_amount: values.payment_amount ?? null,
          rating: values.include_rating
            ? {
                overall: values.overall!,
                food: values.food!,
                service: values.service!,
                atmosphere: values.atmosphere!,
                cost_performance: values.cost_performance!,
              }
            : null,
        },
        user.id
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['restaurants'] })
      navigate(`/restaurants/${id}`, { replace: true })
    },
    onError: (e) => setTopError((e as Error).message),
  })

  const onSubmit: SubmitHandler<FormValues> = (values) => createMut.mutate(values)

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" /> 戻る
      </Button>
      <h1 className="text-xl font-bold">訪問を追加</h1>
      <p className="text-sm text-muted-foreground">
        {restaurantQuery.data?.name ?? '...'}
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="visit_date">訪問日（任意）</Label>
          <Input id="visit_date" type="date" {...form.register('visit_date')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="order_content">注文内容（任意）</Label>
          <Textarea
            id="order_content"
            rows={3}
            {...form.register('order_content')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_amount">支払金額（円・任意）</Label>
          <Input
            id="payment_amount"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            {...form.register('payment_amount')}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            id="include_rating"
            type="checkbox"
            className="h-4 w-4"
            {...form.register('include_rating')}
          />
          <Label htmlFor="include_rating">評価を入力する</Label>
        </div>

        {includeRating && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {RATING_AXES.map((axis) => (
              <div key={axis.key} className="space-y-1">
                <Label htmlFor={axis.key} className="text-xs">
                  {axis.label}（1〜10）
                </Label>
                <Input
                  id={axis.key}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  step={1}
                  {...form.register(axis.key)}
                />
                {form.formState.errors[axis.key] && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors[axis.key]?.message as string}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {topError && <p className="text-sm text-destructive">{topError}</p>}

        <Button type="submit" className="w-full" disabled={createMut.isPending}>
          {createMut.isPending ? '保存中...' : '保存'}
        </Button>
      </form>
    </div>
  )
}
