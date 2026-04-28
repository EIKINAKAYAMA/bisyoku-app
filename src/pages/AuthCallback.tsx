import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const PASSPHRASE_KEY = 'signup_passphrase'
const INTENT_KEY = 'auth_intent'

type Status = 'verifying' | 'fail' | 'done'

export function AuthCallback() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const ran = useRef(false)
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('認証中...')

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      if (!session) {
        // Supabase JS が detectSessionInUrl で処理する前に届くケース。少し待ってリトライ。
        await new Promise((r) => setTimeout(r, 500))
        const retry = await supabase.auth.getSession()
        if (!retry.data.session) {
          setStatus('fail')
          setMessage('セッションが取得できませんでした。')
          setTimeout(() => navigate('/login', { replace: true }), 1500)
          return
        }
      }

      const intent = sessionStorage.getItem(INTENT_KEY)
      const passphrase = sessionStorage.getItem(PASSPHRASE_KEY)

      if (intent === 'signup' && passphrase) {
        const { data, error } = await supabase.functions.invoke<{
          ok: boolean
          error?: string
        }>('verify-passphrase', {
          body: { passphrase },
        })

        sessionStorage.removeItem(INTENT_KEY)
        sessionStorage.removeItem(PASSPHRASE_KEY)

        if (error || !data?.ok) {
          await supabase.auth.signOut()
          setStatus('fail')
          const code = data?.error
          if (code === 'wrong_passphrase') {
            setMessage('合言葉が違います。新規登録からやり直してください。')
            setTimeout(() => navigate('/login?error=passphrase', { replace: true }), 2000)
          } else if (code === 'invalid_email' || code === 'invalid_jwt' || code === 'missing_authorization') {
            setMessage('認証に失敗しました。もう一度お試しください。')
            setTimeout(() => navigate('/login', { replace: true }), 2000)
          } else {
            setMessage('登録処理に失敗しました。時間をおいて再度お試しください。')
            setTimeout(() => navigate('/login', { replace: true }), 2500)
          }
          return
        }

        await refreshProfile()
        setStatus('done')
        navigate('/', { replace: true })
        return
      }

      // /login 経由：profile 存在チェック
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setStatus('fail')
        setMessage('ユーザー情報が取得できませんでした。')
        setTimeout(() => navigate('/login', { replace: true }), 1500)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!profile) {
        await supabase.auth.signOut()
        setStatus('fail')
        setMessage('未招待のアカウントです。新規登録が必要です。')
        setTimeout(() => navigate('/login?error=not-invited', { replace: true }), 2000)
        return
      }

      await refreshProfile()
      navigate('/', { replace: true })
    })()
  }, [navigate, refreshProfile])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <p
          className={
            status === 'fail' ? 'text-destructive' : 'text-muted-foreground'
          }
        >
          {message}
        </p>
      </div>
    </div>
  )
}
