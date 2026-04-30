import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AwardBadge } from '@/components/AwardBadge'
import {
  listAwards,
  type Award,
  type AwardCategory,
  type AwardEntryInput,
} from '@/features/awards/api'
import { qk } from '@/lib/queryKeys'

const CATEGORY_LABELS: Record<AwardCategory, string> = {
  michelin: 'ミシュラン',
  tabelog: '食べログ',
  global: '国際',
  japan_media: '日本メディア',
  other: 'その他',
}

const CATEGORY_ORDER: AwardCategory[] = [
  'michelin',
  'tabelog',
  'global',
  'japan_media',
  'other',
]

const CUSTOM_TOKEN = '__custom__'

const normalize = (s: string) => s.normalize('NFKC').trim().toLowerCase()

type Props = {
  value: AwardEntryInput[]
  onChange: (next: AwardEntryInput[]) => void
}

export function AwardsField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const awardsQuery = useQuery({
    queryKey: qk.awards.all,
    queryFn: listAwards,
  })

  const awardsById = useMemo(() => {
    const map = new Map<string, Award>()
    for (const a of awardsQuery.data ?? []) map.set(a.id, a)
    return map
  }, [awardsQuery.data])

  const handleAdd = (entry: AwardEntryInput) => {
    onChange([...value, entry])
    setOpen(false)
  }

  const handleRemove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((e, i) => {
          const master = e.award_id ? awardsById.get(e.award_id) : null
          const name = master?.name ?? e.custom_label ?? '(不明)'
          const category: AwardCategory = master?.category ?? 'other'
          return (
            <AwardBadge
              key={`${e.award_id ?? 'custom'}-${e.custom_label ?? ''}-${e.year ?? ''}-${i}`}
              name={name}
              category={category}
              year={e.year}
              onRemove={() => handleRemove(i)}
            />
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3 w-3" /> 称号を追加
        </Button>
      </div>

      <AddAwardDialog
        open={open}
        onClose={() => setOpen(false)}
        awards={awardsQuery.data ?? []}
        existingIds={value
          .map((e) => e.award_id)
          .filter((x): x is string => x != null)}
        onAdd={handleAdd}
      />
    </>
  )
}

function AddAwardDialog({
  open,
  onClose,
  awards,
  existingIds,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  awards: Award[]
  existingIds: string[]
  onAdd: (entry: AwardEntryInput) => void
}) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [year, setYear] = useState('')

  const isCustom = selectedId === CUSTOM_TOKEN
  const existingSet = useMemo(() => new Set(existingIds), [existingIds])

  const filtered = useMemo(() => {
    const needle = normalize(search)
    if (!needle) return awards
    return awards.filter((a) => normalize(a.name).includes(needle))
  }, [awards, search])

  /** 検索ヒット結果を category 順 → sort_order 順でグループ化 */
  const grouped = useMemo(() => {
    const map = new Map<AwardCategory, Award[]>()
    for (const a of filtered) {
      const arr = map.get(a.category) ?? []
      arr.push(a)
      map.set(a.category, arr)
    }
    return CATEGORY_ORDER.flatMap((cat) => {
      const list = map.get(cat)
      if (!list || list.length === 0) return []
      return [{ category: cat, items: list }]
    })
  }, [filtered])

  const reset = () => {
    setSearch('')
    setSelectedId(null)
    setCustomLabel('')
    setYear('')
  }

  const yearError = useMemo(() => {
    const t = year.trim()
    if (!t) return null
    const n = Number(t)
    if (!Number.isFinite(n) || n < 1900 || n > 2100) {
      return '1900〜2100 の範囲で入力してください'
    }
    return null
  }, [year])

  const canSubmit =
    yearError == null &&
    (isCustom ? customLabel.trim().length > 0 : selectedId != null)

  const handleSubmit = () => {
    if (!canSubmit) return
    const yearTrim = year.trim()
    const yearNum = yearTrim ? Number(yearTrim) : null
    if (isCustom) {
      const label = customLabel.normalize('NFKC').trim()
      onAdd({ award_id: null, custom_label: label, year: yearNum })
    } else if (selectedId) {
      onAdd({ award_id: selectedId, custom_label: null, year: yearNum })
    }
    reset()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>称号を追加</DialogTitle>
          <DialogDescription>
            マスターから選ぶか、「その他」で自由入力できます。取得年は任意です。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            type="search"
            placeholder="称号を検索..."
            aria-label="称号を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
          />

          <div className="max-h-72 space-y-2 overflow-auto rounded-md border p-2">
            {grouped.map(({ category, items }) => (
              <div key={category}>
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </p>
                <ul className="space-y-0.5">
                  {items.map((a) => {
                    const isSelected = selectedId === a.id
                    const isAlready = existingSet.has(a.id)
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedId(isSelected ? null : a.id)
                          }
                          disabled={isAlready}
                          className={cn(
                            'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                            isSelected && 'bg-accent font-medium',
                            isAlready && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                          )}
                        >
                          {a.name}
                          {isAlready && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              （追加済）
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            {grouped.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                該当なし
              </p>
            )}

            <div className="border-t pt-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedId(isCustom ? null : CUSTOM_TOKEN)
                }
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  isCustom && 'bg-accent font-medium'
                )}
              >
                ✏️ その他（自由入力）
              </button>
            </div>
          </div>

          {isCustom && (
            <div className="space-y-1">
              <Label htmlFor="custom_label">称号名</Label>
              <Input
                id="custom_label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="例: ◯◯市食彩グランプリ"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="award_year">取得年（任意）</Label>
            <Input
              id="award_year"
              type="number"
              inputMode="numeric"
              min={1900}
              max={2100}
              step={1}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="例: 2024"
            />
            {yearError && (
              <p className="text-xs text-destructive">{yearError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
