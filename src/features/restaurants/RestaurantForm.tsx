import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { PRICE_RANGES } from '@/lib/constants'
import type { CreateRestaurantInput } from '@/features/restaurants/api'

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

export type RestaurantFormInitial = {
  name: string
  link: string | null
  genre_id: string
  price_range: (typeof PRICE_RANGES)[number]
}

type Props = {
  initial?: RestaurantFormInitial
  onSubmit: (input: CreateRestaurantInput) => Promise<void>
  submitLabel: string
}

export function RestaurantForm({ initial, onSubmit, submitLabel }: Props) {
  const [topError, setTopError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      link: initial?.link ?? '',
      genre_id: initial?.genre_id ?? '',
      price_range: initial?.price_range ?? '〜2000',
    },
  })

  const handleSubmit = async (values: FormValues) => {
    setTopError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: values.name,
        link: values.link ? values.link : null,
        genre_id: values.genre_id,
        price_range: values.price_range,
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
        <Label htmlFor="name" className="text-base">
          店名
        </Label>
        <Input id="name" {...form.register('name')} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-base">ジャンル</Label>
        <GenreField
          value={form.watch('genre_id') || undefined}
          onChange={(id) => form.setValue('genre_id', id, { shouldValidate: true })}
        />
        {form.formState.errors.genre_id && (
          <p className="text-sm text-destructive">{form.formState.errors.genre_id.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-base">価格帯</Label>
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
        <Label htmlFor="link" className="text-base">
          店のリンク（任意）
        </Label>
        <Input id="link" inputMode="url" placeholder="https://..." {...form.register('link')} />
        {form.formState.errors.link && (
          <p className="text-sm text-destructive">{form.formState.errors.link.message}</p>
        )}
      </div>

      {topError && <p className="text-sm text-destructive">{topError}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? '保存中...' : submitLabel}
      </Button>
    </form>
  )
}
