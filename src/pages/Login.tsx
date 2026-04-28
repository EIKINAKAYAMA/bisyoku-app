import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Login() {
  const { signInWithGoogle } = useAuth()
  const [params] = useSearchParams()
  const error = params.get('error')
  const [signInError, setSignInError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  const handleGoogleSignIn = async () => {
    setSignInError(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setSignInError((e as Error).message)
      setSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <Card className="w-full max-w-sm border-2 shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight md:text-3xl">
            美食 App
          </CardTitle>
          <CardDescription className="text-base">
            家族・友人グループの飲食店レビュー
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === 'not-invited' && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              このアカウントはまだ招待されていません。先に新規登録から合言葉を通してください。
            </p>
          )}
          {error === 'passphrase' && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              合言葉が違います。再度お試しください。
            </p>
          )}
          {signInError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              ログインに失敗しました：{signInError}
            </p>
          )}
          <Button className="w-full" onClick={handleGoogleSignIn} disabled={signingIn}>
            {signingIn ? '...' : 'Google でログイン'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            初めての方は{' '}
            <Link to="/signup" className="font-medium text-primary underline">
              新規登録
            </Link>
          </p>

          {import.meta.env.DEV && <DevLoginPanel />}
        </CardContent>
      </Card>
    </div>
  )
}

/** dev mode 限定。`supabase/seed.sql` が用意するテストユーザーで一発ログイン */
function DevLoginPanel() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const signIn = async (email: string) => {
    setBusy(email)
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'devpass',
    })
    setBusy(null)
    if (error) {
      setErr(`${email}: ${error.message}（seed.sql が適用されていますか？）`)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
      <p className="text-xs text-muted-foreground">DEV ONLY · seed されたテストユーザー</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => signIn('dev1@local.test')}
          disabled={!!busy}
        >
          {busy === 'dev1@local.test' ? '...' : '開発ユーザー 1'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => signIn('dev2@local.test')}
          disabled={!!busy}
        >
          {busy === 'dev2@local.test' ? '...' : '開発ユーザー 2'}
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
