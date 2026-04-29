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

/**
 * Promise を ms 後に reject する race。Supabase 呼び出しが返ってこない時の
 * 出口をフロント側で確実に作るために使う。
 */
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () => reject(new Error(`${label} timeout (${ms}ms)`)),
        ms
      )
    ),
  ])

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
   * profile と auth.users.user_metadata（Google から来る）の avatar_url に差分があれば
   * DB を更新する。display_name はユーザー編集を尊重するため自動同期しない。
   * 失敗してもログインを止めない。
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

    // Safety net: 初回 auth 解決が 8 秒以内に終わらない時の最終出口。正常に解決したら
    // finalize() で clearTimeout され、このコールバックは発火しない（= 警告も出ない）。
    //   - loading=true のまま：getSession() がぶら下がっているケース → 解放
    //   - profileStatus='loading' のまま：fetchProfile のタイムアウトも効かなかった稀なケース
    //     → 'error' に倒して RequireAuth のエラー画面（再読み込みボタン付き）に出口を作る
    const safetyTimeout = window.setTimeout(() => {
      if (cancelled) return
      console.warn('[Auth] safety timeout fired (8s)')
      setLoading(false)
      setProfileStatus((prev) => (prev === 'loading' ? 'error' : prev))
    }, 8000)

    /** auth 初期解決を確定し、safety net をキャンセル */
    const finalize = () => {
      if (cancelled) return
      setLoading(false)
      window.clearTimeout(safetyTimeout)
    }

    const apply = async (next: Session | null, source: string) => {
      if (cancelled) return
      log(source, '→ session user =', next?.user?.id ?? 'null')
      setSession(next)

      const userId = next?.user?.id ?? null

      if (userId === activeUserId) {
        // 同じユーザー（TOKEN_REFRESHED など）：profile fetch は不要
        finalize()
        return
      }

      activeUserId = userId

      if (userId) {
        // 新規ログイン or 別ユーザー：profile を取り直す
        setProfileStatus('loading')
        try {
          // 6 秒以内に返ってこなければエラー扱い。RequireAuth のエラー画面で再読み込み導線を出す
          const p = await withTimeout(fetchProfile(userId), 6000, 'fetchProfile')
          if (cancelled || activeUserId !== userId) return
          log(source, '✓ profile loaded:', p?.display_name ?? '(no row)')

          // ここでまず profile を反映してログインを完了させる。
          // avatar 同期（Google 側差分の UPDATE）は副次処理なので非同期に流して
          // ログインの待ち時間に乗せない。差分があれば setProfile で後から反映する。
          setProfile(p)
          setProfileStatus('ok')

          if (p) {
            void withTimeout(syncFromAuthMeta(p, next), 4000, 'syncFromAuthMeta')
              .then((synced) => {
                if (cancelled || activeUserId !== userId) return
                if (synced && synced !== p) setProfile(synced)
              })
              .catch((e) => log('syncFromAuthMeta skipped:', e))
          }
        } catch (e) {
          if (cancelled || activeUserId !== userId) return
          log(source, '✗ profile fetch failed:', e)
          setProfileStatus('error')
          // profile は前の値のままにする（誤遷移防止）
        } finally {
          finalize()
        }
      } else {
        // ログアウト
        setProfile(null)
        setProfileStatus('idle')
        finalize()
      }
    }

    // 初期セッション取得（高速・確実）
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error('[Auth] getSession returned error:', error)
        void apply(data.session, 'getSession')
      })
      .catch((e) => {
        console.error('[Auth] getSession threw:', e)
        finalize()
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
