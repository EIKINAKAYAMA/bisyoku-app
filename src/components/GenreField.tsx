import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { listGenres } from '@/features/genres/api'
import { qk } from '@/lib/queryKeys'

type Props = {
  value: string | undefined
  onChange: (id: string) => void
}

const normalize = (s: string) => s.normalize('NFKC').trim().toLowerCase()

export function GenreField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const genresQuery = useQuery({
    queryKey: qk.genres.all,
    queryFn: listGenres,
  })

  const selected = useMemo(
    () => genresQuery.data?.find((g) => g.id === value),
    [genresQuery.data, value]
  )

  const filtered = useMemo(() => {
    const list = genresQuery.data ?? []
    const needle = normalize(search)
    if (!needle) return list
    return list.filter((g) => normalize(g.name).includes(needle))
  }, [genresQuery.data, search])

  const close = () => {
    setOpen(false)
    setSearch('')
  }

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (open) searchInputRef.current?.focus()
  }, [open])

  const handleSelect = (id: string) => {
    onChange(id)
    close()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          !selected && 'text-muted-foreground'
        )}
      >
        <span className="truncate">{selected ? selected.name : 'ジャンルを選択'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="ジャンルを検索..."
              aria-label="ジャンルを検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  close()
                } else if (e.key === 'Enter') {
                  // 候補 0 件でも親フォームに submit を伝播させない
                  e.preventDefault()
                  if (filtered[0]) handleSelect(filtered[0].id)
                }
              }}
              className="h-9"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">該当なし</li>
            ) : (
              filtered.map((g) => {
                const isSelected = g.id === value
                return (
                  <li key={g.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(g.id)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                        isSelected && 'bg-accent text-accent-foreground'
                      )}
                    >
                      <span>{g.name}</span>
                      {isSelected && <Check className="h-4 w-4" />}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
