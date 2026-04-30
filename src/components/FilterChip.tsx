import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

type Option = { value: string; label: string }

type Props = {
  /** ラベル（未選択時の表示・選択時は `${label}: ${optionLabel}`） */
  label: string
  value: string
  /** これと一致するときは「未適用」扱い（選択肢としては「全て」相当） */
  defaultValue: string
  onChange: (next: string) => void
  options: Option[]
  /** デフォルト値選択肢のラベル（chip 化された Select の先頭に挿入される） */
  allLabel?: string
  /** 一覧で SelectTrigger 上にアイコンを 1 個入れたい場合（地理など） */
  startIcon?: React.ReactNode
}

/**
 * Select をチップ風に styled したフィルタ単位 UI。
 *
 * - 未適用（value === defaultValue）：outline / ラベルのみ表示
 * - 適用中：primary 塗りつぶし / `${label}: ${value のラベル}` 表示
 * - クリアは popover 内の「全て」項目選択で行う（チップ自体に ✕ は付けない。
 *   トリガー領域と分けると Radix Select の click 制御が複雑になるため）
 */
export function FilterChip({
  label,
  value,
  defaultValue,
  onChange,
  options,
  allLabel = '全て',
  startIcon,
}: Props) {
  const isActive = value !== defaultValue
  const activeOption = options.find((o) => o.value === value)
  const display = isActive ? `${label}: ${activeOption?.label ?? '...'}` : label

  // defaultValue と同じ value を持つ option は除外する。先頭に置く allLabel item
  // と二重表示・duplicate React key になるのを防ぐ（例：並びチップで `recent` を
  // options 側にも入れてしまったとき）。
  const optionsWithoutDefault = options.filter((o) => o.value !== defaultValue)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          // shadcn のデフォルト（h-10 / w-full / rounded-md）を上書きするため
          // tailwind-merge に頼って明示的に対応プロパティを書く。
          'inline-flex h-9 w-auto shrink-0 items-center justify-between gap-1.5 rounded-full px-3 py-0 text-xs font-medium transition-colors',
          isActive
            ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
        )}
        aria-label={label}
      >
        <span className="inline-flex items-center gap-1 truncate">
          {startIcon}
          {display}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={defaultValue}>{allLabel}</SelectItem>
        {optionsWithoutDefault.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
