import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PASSPHRASE_KEY = 'signup_passphrase'
const INTENT_KEY = 'auth_intent'

export function Signup() {
  const { signInWithGoogle } = useAuth()
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) return
    setSubmitting(true)
    sessionStorage.setItem(PASSPHRASE_KEY, passphrase)
    sessionStorage.setItem(INTENT_KEY, 'signup')
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error(err)
      sessionStorage.removeItem(PASSPHRASE_KEY)
      sessionStorage.removeItem(INTENT_KEY)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">新規登録</CardTitle>
          <CardDescription>合言葉を入力した後、Google でログインしてください。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passphrase">合言葉</Label>
              <Input
                id="passphrase"
                type="password"
                autoComplete="off"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '処理中...' : 'Google で登録'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              既にアカウントをお持ちの方は{' '}
              <Link to="/login" className="font-medium text-primary underline">
                ログイン
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
