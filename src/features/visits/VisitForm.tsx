import { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RATING_AXES } from '@/lib/constants'
import type { RatingInput, VisitInput } from '@/features/visits/api'

const ratingNum = z
  .number({ invalid_type_error: '数値を入力' })
  .int()
  .min(1, '1〜10')
  .max(10, '1〜10')

const schema = z
  .object({
    visit_date: z.string().optional().or(z.literal('')),
    order_content: z.string().max(2000).optional().or(z.literal('')),
    payment_amount: z
      .preprocess(
        (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
        z.union([z.null(), z.number().int().min(0)])
      )
      .optional(),
    comment: z.string().max(4000).optional().or(z.literal('')),
    include_rating: z.boolean(),
    overall: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
    food: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
    service: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
    atmosphere: z.preprocess((v) => (v === '' ? undefined : Number(v)), ratingNum.optional()),
    cost_performance: z.preprocess(
      (v) => (v === '' ? undefined : Number(v)),
      ratingNum.optional()
    ),
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

export type VisitFormInitial = {
  visit_date: string | null
  order_content: string | null
  payment_amount: number | null
  comment: string | null
  rating: RatingInput | null
}

type Props = {
  initial?: VisitFormInitial
  onSubmit: (input: VisitInput) => Promise<void>
  submitLabel: string
}

export function VisitForm({ initial, onSubmit, submitLabel }: Props) {
  const [topError, setTopError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visit_date: initial?.visit_date ?? '',
      order_content: initial?.order_content ?? '',
      payment_amount: initial?.payment_amount ?? null,
      comment: initial?.comment ?? '',
      include_rating: initial?.rating != null,
      overall: initial?.rating?.overall,
      food: initial?.rating?.food,
      service: initial?.rating?.service,
      atmosphere: initial?.rating?.atmosphere,
      cost_performance: initial?.rating?.cost_performance,
    },
  })

  const includeRating = form.watch('include_rating')

  const handleSubmit: SubmitHandler<FormValues> = async (values) => {
    setTopError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        visit_date: values.visit_date ? values.visit_date : null,
        order_content: values.order_content ? values.order_content : null,
        payment_amount: values.payment_amount ?? null,
        comment: values.comment ? values.comment : null,
        rating: values.include_rating
          ? {
              overall: values.overall!,
              food: values.food!,
              service: values.service!,
              atmosphere: values.atmosphere!,
              cost_performance: values.cost_performance!,
            }
          : null,
      })
    } catch (e) {
      setTopError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="visit_date" className="text-base">
          訪問日（任意）
        </Label>
        <Input id="visit_date" type="date" {...form.register('visit_date')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="order_content" className="text-base">
          注文内容（任意）
        </Label>
        <Textarea id="order_content" rows={3} {...form.register('order_content')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_amount" className="text-base">
          支払金額（円・任意）
        </Label>
        <Input
          id="payment_amount"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          {...form.register('payment_amount')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment" className="text-base">
          コメント（任意）
        </Label>
        <Textarea
          id="comment"
          rows={4}
          placeholder="感想や気付きをひと言..."
          {...form.register('comment')}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          id="include_rating"
          type="checkbox"
          className="h-4 w-4 accent-primary"
          {...form.register('include_rating')}
        />
        <Label htmlFor="include_rating" className="text-base">
          評価を入力する
        </Label>
      </div>

      {includeRating && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4 sm:grid-cols-5">
          {RATING_AXES.map((axis) => (
            <div key={axis.key} className="space-y-1">
              <Label htmlFor={axis.key} className="text-sm font-medium">
                {axis.label}
              </Label>
              <Input
                id={axis.key}
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                className="text-center text-lg font-bold"
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

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? '保存中...' : submitLabel}
      </Button>
    </form>
  )
}
