import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listGenres, createGenre } from '@/features/genres/api'
import { useAuth } from '@/features/auth/AuthProvider'
import { qk } from '@/lib/queryKeys'

type Props = {
  value: string | undefined
  onChange: (id: string) => void
}

export function GenreField({ value, onChange }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const genresQuery = useQuery({
    queryKey: qk.genres.all,
    queryFn: listGenres,
  })

  const createMut = useMutation({
    mutationFn: (name: string) => {
      if (!user) throw new Error('未ログイン')
      return createGenre(name, user.id)
    },
    onSuccess: (genre) => {
      queryClient.invalidateQueries({ queryKey: qk.genres.all })
      onChange(genre.id)
      setAdding(false)
      setNewName('')
      setError(null)
    },
    onError: (e) => {
      setError((e as Error).message)
    },
  })

  if (adding) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="新しいジャンル名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <Button
            type="button"
            onClick={() => createMut.mutate(newName)}
            disabled={createMut.isPending || !newName.trim()}
          >
            追加
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAdding(false)
              setNewName('')
              setError(null)
            }}
          >
            キャンセル
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="ジャンルを選択" />
        </SelectTrigger>
        <SelectContent>
          {(genresQuery.data ?? []).map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
