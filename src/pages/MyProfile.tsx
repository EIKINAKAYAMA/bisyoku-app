import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListChecks, LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { listProfiles, updateProfile } from '@/features/users/api'
import { Avatar } from '@/components/ui/avatar'
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
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">プロフィール</h1>
      </header>

      <Card>
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex items-center gap-4 md:gap-5">
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name}
              alt={profile.display_name}
              className="h-20 w-20 text-2xl shadow-md ring-2 ring-primary/20 md:h-24 md:w-24"
            />
            <div className="min-w-0 flex-1">
              {!editing ? (
                <>
                  <p className="text-xs text-muted-foreground">表示名</p>
                  <p className="mt-0.5 truncate text-xl font-semibold md:text-2xl">
                    {profile.display_name}
                  </p>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="display_name">表示名</Label>
                  <Input
                    id="display_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {!editing ? (
            <div className="flex flex-wrap gap-2">
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
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending || !name.trim()}
              >
                保存
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                キャンセル
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            アイコンは Google アカウントに登録された画像が自動で反映されます。
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">メンバー</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {profilesQuery.data?.map((p) => (
            <li key={p.id}>
              <Link to={`/users/${p.id}`} className="block">
                <Card className="transition-colors hover:border-primary/40 hover:bg-accent/30">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Avatar
                      src={p.avatar_url}
                      fallback={p.display_name}
                      alt={p.display_name}
                      className="h-10 w-10"
                    />
                    <p className="min-w-0 truncate font-medium">{p.display_name}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="outline" className="w-full sm:w-auto" onClick={() => signOut()}>
        <LogOut className="h-4 w-4" /> ログアウト
      </Button>
    </div>
  )
}
