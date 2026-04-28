import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListChecks } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { listProfiles, updateProfile } from '@/features/users/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MyProfile() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const queryClient = useQueryClient()

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
  })

  const [name, setName] = useState(profile?.display_name ?? '')
  const [editing, setEditing] = useState(false)

  const updateMut = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('未ログイン')
      return updateProfile(user.id, { display_name: name.trim() })
    },
    onSuccess: async () => {
      await refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setEditing(false)
    },
  })

  if (!profile) return null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">プロフィール</h1>
      </header>

      <Card>
        <CardContent className="space-y-3 p-4">
          {!editing ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">表示名</p>
                <p className="text-lg font-semibold">{profile.display_name}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setName(profile.display_name)
                    setEditing(true)
                  }}
                >
                  名前を変更
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/users/${profile.id}`}>
                    <ListChecks className="h-4 w-4" /> 自分の訪問履歴
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="display_name">表示名</Label>
                <Input
                  id="display_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateMut.mutate()}
                  disabled={updateMut.isPending || !name.trim()}
                >
                  保存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  キャンセル
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">メンバー</h2>
        <ul className="space-y-2">
          {profilesQuery.data?.map((p) => (
            <li key={p.id}>
              <Link to={`/users/${p.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="p-3">
                    <p className="font-medium">{p.display_name}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="outline" className="w-full" onClick={() => signOut()}>
        ログアウト
      </Button>
    </div>
  )
}
