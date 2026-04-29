import { useState } from 'react'
import { useForm, type SubmitErrorHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { focusFirstFormError } from '@/lib/formErrors'
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

// 任意の URL 欄に共通のバリデーション：未入力 OK・入力されていれば http(s)://
const optionalUrl = z
  .string()
  .max(1000)
  .refine(
    (v) => !v || /^https?:\/\//.test(v),
    'http(s):// から始まる URL を入力してください'
  )
  .optional()
  .or(z.literal(''))

const schema = z.object({
  name: z.string().min(1, '店名を入力してください').max(120),
  link: optionalUrl,
  genre_id: z.string().min(1, 'ジャンルを選択してください'),
  price_range: z.enum(PRICE_RANGES),
  google_maps_url: optionalUrl,
  tabelog_url: optionalUrl,
  area: z.string().max(60).optional().or(z.literal('')),
})
type FormValues = z.infer<typeof schema>

export type RestaurantFormInitial = {
  name: string
  link: string | null
  genre_id: string
  price_range: (typeof PRICE_RANGES)[number]
  google_maps_url: string | null
  tabelog_url: string | null
  area: string | null
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
      google_maps_url: initial?.google_maps_url ?? '',
      tabelog_url: initial?.tabelog_url ?? '',
      area: initial?.area ?? '',
    },
  })

  const handleSubmit = async (values: FormValues) => {
    setTopError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: values.name,
        link: values.link?.trim() ? values.link.trim() : null,
        genre_id: values.genre_id,
        price_range: values.price_range,
        google_maps_url: values.google_maps_url?.trim()
          ? values.google_maps_url.trim()
          : null,
        tabelog_url: values.tabelog_url?.trim() ? values.tabelog_url.trim() : null,
        area: values.area?.trim() ? values.area.trim() : null,
      })
    } catch (e) {
      setTopError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const onInvalid: SubmitErrorHandler<FormValues> = (errors) => {
    setTopError('入力内容に不備があります。赤字の項目をご確認ください。')
    focusFirstFormError(errors)
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit, onInvalid)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base">
          店名
        </Label>
        <Input id="name" {...form.register('name')} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2" id="field-genre_id">
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
        <Label htmlFor="area" className="text-base">
          エリア（任意）
        </Label>
        <Input
          id="area"
          placeholder="例: 渋谷 / 自由が丘 / 横浜駅周辺"
          {...form.register('area')}
        />
        <p className="text-xs text-muted-foreground">
          一覧のエリア絞り込みに使います。短いラベルで OK。
        </p>
        {form.formState.errors.area && (
          <p className="text-sm text-destructive">{form.formState.errors.area.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="google_maps_url" className="text-base">
          Google Maps の URL（任意）
        </Label>
        <Input
          id="google_maps_url"
          inputMode="url"
          placeholder="https://www.google.com/maps/place/..."
          {...form.register('google_maps_url')}
        />
        <p className="text-xs text-muted-foreground">
          Google Maps で「共有」→「リンクをコピー」を貼り付け。
          <strong>フルパス URL</strong> を貼ると地図プレビューと「近い順」の距離計算が有効になります（短縮 URL <code>maps.app.goo.gl/...</code> でもボタンは動作します）。
        </p>
        {form.formState.errors.google_maps_url && (
          <p className="text-sm text-destructive">
            {form.formState.errors.google_maps_url.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tabelog_url" className="text-base">
          食べログの URL（任意）
        </Label>
        <Input
          id="tabelog_url"
          inputMode="url"
          placeholder="https://tabelog.com/tokyo/..."
          {...form.register('tabelog_url')}
        />
        <p className="text-xs text-muted-foreground">
          詳細画面の <strong>食べログボタン</strong> がこの URL を直接開きます。
          未入力の場合は店名で検索ページへ飛ばします。
        </p>
        {form.formState.errors.tabelog_url && (
          <p className="text-sm text-destructive">
            {form.formState.errors.tabelog_url.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="link" className="text-base">
          その他のリンク（任意）
        </Label>
        <Input
          id="link"
          inputMode="url"
          placeholder="公式サイト・予約ページなど"
          {...form.register('link')}
        />
        <p className="text-xs text-muted-foreground">
          公式サイト・Instagram・予約ページなど、Google Maps と食べログ以外のリンクを 1 つだけ。
        </p>
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
