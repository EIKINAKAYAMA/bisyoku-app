import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Login() {
  const { signInWithGoogle } = useAuth()
  const [params] = useSearchParams()
  const error = params.get('error')

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">美食 App</CardTitle>
          <CardDescription>家族・友人グループの飲食店レビュー</CardDescription>
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
          <Button className="w-full" onClick={() => signInWithGoogle()}>
            Google でログイン
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            初めての方は{' '}
            <Link to="/signup" className="font-medium text-primary underline">
              新規登録
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
