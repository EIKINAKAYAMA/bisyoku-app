import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

/** profile 取得結果の状態 */
type ProfileStatus = 'idle' | 'loading' | 'ok' | 'error'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  profileStatus: ProfileStatus
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log('[Auth]', ...args)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle')
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[Auth] fetchProfile DB error:', error)
      throw error
    }
    return data
  }

  /**
   * profile と auth.users.user_metadata（Google から来る）に差分があれば DB を更新。
   * Google アイコン・名前を最新化する。失敗してもログインを止めない。
   */
  const syncFromAuthMeta = async (
    current: Profile | null,
    next: Session | null
  ): Promise<Profile | null> => {
    if (!current || !next?.user) return current
    const meta = (next.user.user_metadata ?? {}) as Record<string, unknown>
    const metaAvatar =
      (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
      (typeof meta.picture === 'string' && meta.picture) ||
      null
    const patch: { avatar_url?: string | null } = {}
    if (metaAvatar && metaAvatar !== current.avatar_url) patch.avatar_url = metaAvatar
    if (Object.keys(patch).length === 0) return current
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', current.id)
      .select('*')
      .single()
    if (error) {
      console.warn('[Auth] avatar sync skipped:', error.message)
      return current
    }
    log('synced avatar from Google')
    return data
  }

  useEffect(() => {
    let cancelled = false
    let activeUserId: string | null = null

    const apply = async (next: Session | null, source: string) => {
      if (cancelled) return
      log(source, '→ session user =', next?.user?.id ?? 'null')
      setSession(next)

      const userId = next?.user?.id ?? null

      if (userId === activeUserId) {
        // 同じユーザー（TOKEN_REFRESHED など）：profile fetch は不要
        // ただし初回マウントで loading=true のままだったら解除する
        if (!cancelled) setLoading(false)
        return
      }

      activeUserId = userId

      if (userId) {
        // 新規ログイン or 別ユーザー：profile を取り直す
        setProfileStatus('loading')
        try {
          const p = await fetchProfile(userId)
          if (cancelled || activeUserId !== userId) return
          log(source, '✓ profile loaded:', p?.display_name ?? '(no row)')

          // Google の最新 avatar_url / display_name と差分があれば profile を同期
          const synced = await syncFromAuthMeta(p, next)
          if (cancelled || activeUserId !== userId) return

          setProfile(synced)
          setProfileStatus('ok')
        } catch (e) {
          if (cancelled || activeUserId !== userId) return
          log(source, '✗ profile fetch failed:', e)
          setProfileStatus('error')
          // profile は前の値のままにする（誤遷移防止）
        } finally {
          if (!cancelled) setLoading(false)
        }
      } else {
        // ログアウト
        setProfile(null)
        setProfileStatus('idle')
        setLoading(false)
      }
    }

    // Safety net: 8 秒で必ず loader を解放
    const safetyTimeout = window.setTimeout(() => {
      if (!cancelled) {
        console.warn('[Auth] safety timeout fired (8s)')
        setLoading(false)
      }
    }, 8000)

    // 初期セッション取得（高速・確実）
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error('[Auth] getSession returned error:', error)
        void apply(data.session, 'getSession')
      })
      .catch((e) => {
        console.error('[Auth] getSession threw:', e)
        if (!cancelled) setLoading(false)
      })

    // 以降の変更を購読（INITIAL_SESSION は上の getSession で処理済なのでスキップ）
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return
      void apply(next, event)
    })

    return () => {
      cancelled = true
      window.clearTimeout(safetyTimeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}#/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileStatus('idle')
  }

  const refreshProfile = async () => {
    if (!session?.user) return
    try {
      const p = await fetchProfile(session.user.id)
      setProfile(p)
      setProfileStatus('ok')
    } catch {
      setProfileStatus('error')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        profileStatus,
        loading,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
