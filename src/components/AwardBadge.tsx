import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AwardCategory } from '@/features/awards/api'

type Props = {
  name: string
  category: AwardCategory
  year: number | null
  /** 与えられると × ボタンを出す（フォーム編集用途） */
  onRemove?: () => void
  size?: 'sm' | 'md'
}

const categoryStyles: Record<AwardCategory, string> = {
  michelin:    'bg-red-50 text-red-700 border-red-200',
  tabelog:     'bg-amber-50 text-amber-800 border-amber-200',
  global:      'bg-blue-50 text-blue-700 border-blue-200',
  japan_media: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  other:       'bg-slate-100 text-slate-700 border-slate-200',
}

export function AwardBadge({ name, category, year, onRemove, size = 'md' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        categoryStyles[category]
      )}
    >
      <span className="truncate">{name}</span>
      {year != null && (
        <span className="opacity-70">&apos;{String(year).slice(-2)}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} を削除`}
          className="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
