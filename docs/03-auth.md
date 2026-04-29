# 03. 認証フロー

## 設計上の根本前提

- SPA のコードは全てクライアントに露出するため、**合言葉は絶対にフロントへ埋め込まない**
- 「Google で認証された本人のメール」と「合言葉を通したメール」を一致させるため、**合言葉照合は OAuth の後**に行う
- 認可判定は「`profiles` レコードが存在すること」で行う（RLS の共通条件 `is_invited_user()` も同じ判定）

## サインアップ（新規登録）フロー

```
[/signup]
   │ 合言葉入力 → setSignupIntent()
   │   sessionStorage.signup_passphrase = 入力値
   │   sessionStorage.auth_intent       = 'signup'
   ▼
[Google OAuth へリダイレクト]
   │
   ▼
[#/auth/callback (AuthCallback.tsx)]
   │ supabase.auth.getSession()
   │ readSignupIntent() ← intent が 'signup' なら↓
   ▼
[Edge Function: verify-passphrase]
   POST { passphrase } + Authorization: Bearer <user_jwt>
   │ ┌─ JWT 検証 → email 抽出 (regex で defensive validation)
   │ ├─ SHA-256(SALT + passphrase) を定数時間比較
   │ ├─ OK : allowed_emails upsert + profiles upsert (Service Role)
   │ └─ NG : auth.users.deleteUser() で巻き戻し
   ▼
[OK]   clearSignupIntent() → refreshProfile() → /
[NG]   signOut() → /login?error=passphrase or /login?error=not-invited
```

実装：
- `src/pages/Signup.tsx`
- `src/features/auth/signupIntent.ts`（sessionStorage キーの集約）
- `src/pages/AuthCallback.tsx`
- `supabase/functions/verify-passphrase/index.ts`

## ログイン（2 回目以降）フロー

```
[/login] ─ Google でログイン ─▶ [Google OAuth] ─▶ [#/auth/callback]
                                                       │
                                                       │ readSignupIntent() ← intent !== 'signup'
                                                       ▼
                                                profile 存在チェック
                                                  存在 → /  へ
                                                  不在 → signOut() → /login?error=not-invited
```

実装：`src/pages/Login.tsx` + `src/pages/AuthCallback.tsx` の後半。

## DEV ONLY 一発ログイン

`import.meta.env.DEV` の時のみ、Login 画面の下部に「開発ユーザー 1 / 2」ボタンが出る。
`signInWithPassword({ email: 'dev1@local.test', password: 'devpass' })` で OAuth を経由せず即ログイン。`supabase/seed.sql` が用意するテストユーザー専用。

## セッション管理

`src/lib/supabase.ts`：

```ts
createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',     // OAuth は PKCE フロー
  },
})
```

`src/features/auth/AuthProvider.tsx` がセッション・プロフィール・ローディング状態を管理：

| state | 意味 |
|---|---|
| `session` | Supabase Session（null なら未ログイン） |
| `user` | `session.user` |
| `profile` | `profiles` テーブルの行（null なら未招待） |
| `profileStatus` | `'idle' \| 'loading' \| 'ok' \| 'error'` |
| `loading` | 初期セッション取得中フラグ |

挙動：
- 起動時に `getSession()` で初期セッション取得
- 以降は `onAuthStateChange()` で session 変化を購読（`INITIAL_SESSION` イベントは初期取得と二重になるので無視）
- `userId` が変わった時のみ `profiles` を fetch（TOKEN_REFRESHED 等での無駄な再取得を避ける）
- ログイン直後に `syncFromAuthMeta()` が Google の `avatar_url` / `picture` と DB の差分を patch（**`display_name` は同期しない＝ユーザー編集尊重**）
- 8 秒の safety timeout：`getSession()` がぶら下がっても loader を解放してハングしない

`<RequireAuth>`（`src/features/auth/RequireAuth.tsx`）の判定：

| 条件 | 表示 |
|---|---|
| `loading` または `profileStatus === 'loading'` | 読み込み中... |
| `session` なし | `/login` へ |
| `profileStatus === 'error'` | 再読み込みボタン付きエラー画面 |
| `profile` 不在（status は ok） | `/login?error=not-invited` |
| 通常 | children |

## Edge Function: `verify-passphrase`

`supabase/functions/verify-passphrase/index.ts`。Deno + `@supabase/supabase-js`。

### 入力
```
POST /functions/v1/verify-passphrase
Authorization: Bearer <user_jwt>
Content-Type: application/json
{ "passphrase": "..." }
```

### 環境変数（Secrets）
| 変数 | 用途 |
|---|---|
| `SIGNUP_PASSPHRASE_HASH` | hex 文字列 SHA-256(SALT + passphrase) |
| `SIGNUP_PASSPHRASE_SALT` | ランダム 32 文字 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase が自動注入 |
| `SUPABASE_ANON_KEY` | Supabase が自動注入（JWT 検証用クライアントを作る時に使う） |

### 処理
1. `OPTIONS` プリフライトには 200 + `corsHeaders` を即返す
2. `Authorization` ヘッダの JWT を ANON_KEY 経由のクライアントで検証 → `auth.getUser()` で email 取得
3. **email を regex で defensive validation**（`^[^\s@]+@[^\s@]+\.[^\s@]+$`）
4. `crypto.subtle.digest('SHA-256', SALT + passphrase)` を hex 化し、保管された HASH と**定数時間比較**
5. OK：Service Role クライアントで `allowed_emails` upsert + `profiles` upsert（`display_name` / `avatar_url` を `user_metadata.full_name` / `name`、`avatar_url` / `picture` から自動コピー）
6. NG：`admin.deleteUser(user.id)` で auth.users を巻き戻し

### CORS

GitHub Pages → `*.supabase.co` は別オリジン。`supabase/functions/_shared/cors.ts`：

```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

## 合言葉ハッシュの方針

守るべきは単一の固定値（DB のパスワード一覧ではない）。argon2/bcrypt のような外部依存は不要で、Edge Function 内で `crypto.subtle.digest('SHA-256', salt + passphrase)` ＋ 定数時間比較で十分。Secret には `SIGNUP_PASSPHRASE_HASH`（hex 文字列）と `SIGNUP_PASSPHRASE_SALT` を別々に登録する。

合言葉変更：
```bash
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<新しい合言葉>" | shasum -a 256 | awk '{print $1}')
supabase secrets set SIGNUP_PASSPHRASE_SALT="$SALT" SIGNUP_PASSPHRASE_HASH="$HASH"
```
Edge Function の再デプロイは不要（Secrets は実行時に読まれる）。

## OAuth の URL 設定（2 箇所必須）

どちらか片方だけだと OAuth は動かない。

1. **Google Cloud Console**（OAuth 2.0 Client の Authorized redirect URIs）
   - `https://<project-ref>.supabase.co/auth/v1/callback`（本番）
   - `http://127.0.0.1:54321/auth/v1/callback`（ローカル）
2. **Supabase ダッシュボード**（Authentication → URL Configuration）
   - Site URL：`https://<github-user>.github.io/bisyoku-app/`
   - Additional Redirect URLs：`http://localhost:5173/`、`http://127.0.0.1:5173/`

## 既知のエッジケース（仕様として割り切る）

- **OAuth リダイレクト中にタブを閉じる / 別タブで戻る** → sessionStorage の合言葉が失われる。クライアントは「`profile` 不在 ＋ 合言葉なし」を検知したら signOut + `/signup` に戻す。家族・友人運用前提なので追加対策はしない。
- **孤児 `auth.users`**（OAuth 通過後に `verify-passphrase` 完了せず離脱）はクリーンアップしない。無料枠の DB 容量を圧迫しないため放置。
- **`genres` 同時作成 race（UNIQUE 違反）** → クライアントは挿入失敗（PostgreSQL `23505`）を検知したら「すでに存在します。再選択してください」を表示し、`genres` を refetch して既存値を選ばせる。サーバ側は何もしない。
