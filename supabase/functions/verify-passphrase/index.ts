// 招待制サインアップの合言葉検証 Edge Function
//
// 入力: POST { passphrase: string } + Authorization: Bearer <user_jwt>
// 動作:
//   - JWT 検証 → email を抽出
//   - email 形式 regex で defensive validation
//   - 合言葉ハッシュ照合（SHA-256(salt + passphrase) を定数時間比較）
//   - OK : allowed_emails 追加 + profiles 作成（display_name / avatar_url を Google メタから）
//   - NG : auth.users を巻き戻し（admin.deleteUser）
//
// Secrets:
//   SIGNUP_PASSPHRASE_HASH (hex)
//   SIGNUP_PASSPHRASE_SALT
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Supabase が自動注入)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const PASSPHRASE_HASH = Deno.env.get('SIGNUP_PASSPHRASE_HASH') ?? ''
  const PASSPHRASE_SALT = Deno.env.get('SIGNUP_PASSPHRASE_SALT') ?? ''

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    console.error('Supabase auto-injected env vars are missing')
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  }
  if (!PASSPHRASE_HASH || !PASSPHRASE_SALT) {
    console.error('SIGNUP_PASSPHRASE_HASH / _SALT are not configured')
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  }

  // 認可ヘッダから JWT を取得
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ ok: false, error: 'missing_authorization' }, { status: 401 })
  }

  // 認証ユーザーの取得：ANON_KEY + Authorization ヘッダで JWT を検証する
  // （Service Role を使うと RLS バイパス文脈になり認証用途として不適切）
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return jsonResponse({ ok: false, error: 'invalid_jwt' }, { status: 401 })
  }
  const user = userData.user
  const email = user.email ?? ''

  if (!EMAIL_RE.test(email)) {
    await rollback(SUPABASE_URL, SERVICE_ROLE, user.id)
    return jsonResponse({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  // 合言葉照合
  let body: { passphrase?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const passphrase = body.passphrase ?? ''
  if (!passphrase) {
    return jsonResponse({ ok: false, error: 'missing_passphrase' }, { status: 400 })
  }

  const computed = await sha256Hex(PASSPHRASE_SALT + passphrase)
  if (!constantTimeEqual(computed, PASSPHRASE_HASH.toLowerCase())) {
    await rollback(SUPABASE_URL, SERVICE_ROLE, user.id)
    return jsonResponse({ ok: false, error: 'wrong_passphrase' }, { status: 403 })
  }

  // 合言葉 OK → allowed_emails 追加 + profiles 作成
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  })

  const { error: allowErr } = await admin
    .from('allowed_emails')
    .upsert({ email }, { onConflict: 'email' })
  if (allowErr) {
    console.error('allowed_emails upsert failed', allowErr)
    return jsonResponse({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    email.split('@')[0]
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null

  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: avatarUrl },
      { onConflict: 'id' }
    )
  if (profileErr) {
    console.error('profile upsert failed', profileErr)
    return jsonResponse({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return jsonResponse({ ok: true })
})

async function rollback(url: string, key: string, userId: string) {
  try {
    const admin = createClient(url, key, { auth: { persistSession: false } })
    await admin.auth.admin.deleteUser(userId)
  } catch (e) {
    console.error('rollback failed', e)
  }
}
