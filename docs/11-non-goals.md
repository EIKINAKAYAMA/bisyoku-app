# 11. やらないこと（非ゴール）と設計判断の根拠

このドキュメントの目的：**過去に検討し意図的に外した選択肢**を残し、AI 開発者が同じ提案を繰り返さないようにする。

## 機能スコープから明示的に外しているもの

### 写真・動画のアップロード／配信
- **理由**：Free Tier の Storage 容量・帯域を消費する。家族・友人スケールでもすぐ膨らむ。登録ハードルも高くなる
- **代替**：Google Maps / 食べログのリンクでビジュアル情報は本家を見てもらう

### 一般公開・SEO 最適化
- 招待制クローズドが前提。robots / OGP の最適化はやらない

### ネイティブアプリ（iOS / Android）
- PWA で「ホーム画面に追加」が機能していれば十分。ストア審査・申請のコストに見合わない

### リアルタイム同期（Supabase Realtime）
- グループ規模が小さく同時編集の頻度がほぼ無い。再 fetch + invalidation で十分新鮮
- Realtime channel を貼ると WS コネクションが残り、Free Tier の制限に近づく

### 課金・有料機能
- Hobby app

### モデレーション・編集履歴・通報
- 信頼ベースの小グループ前提

### 客観評価（Google / 食べログのスコアの取り込み・キャッシュ）
- スクレイピングは ToS リスク。LLM 抽出は運用コストと精度劣化リスク。**本家にワンタップで飛ばす方が情報も新鮮**で、コードも一行で済む

## 過去に試して捨てた実装

### Nominatim ベースの近似住所登録 + 検索キーワード自動構成
- **やったこと**：店舗の住所を Nominatim で正規化し、Google Maps / 食べログの URL は店名 + 住所のテキスト検索で構築
- **問題**：小さな店は OSM 未登録のことが多く、近隣駅で代替登録されると外部ボタンが正確な店舗に当たらない
- **結論**：ユーザーが直接 URL を貼る方式（migration 0003）に統一。**API キー不要・スクレイピング無し・依存追加無し**で最も確実

### 細かい vendor chunk 分割
- **やったこと**：`react / radix / tanstack / その他` で chunk を 4〜5 個に分割
- **問題**：Vite の CJS→ESM interop と ESM 静的 import 解決の組み合わせで、別 chunk の React `forwardRef` が undefined のまま lucide-react / radix の本体が評価される事故（`Cannot read properties of undefined (reading 'forwardRef')`）
- **結論**：React に依存する node_modules は同一 chunk に集約。Supabase だけ分離（[`09-pwa-build.md`](./09-pwa-build.md) 参照）

### `BrowserRouter`（pushState）
- 検討したが GitHub Pages のサブパス配信で `404.html` redirect トリックが必要、OAuth リダイレクト URL の整合も増える
- **結論**：HashRouter で十分シンプル

### Postgres 関数ベースの集計（pg_cron / Materialized View）
- pg_cron はプロジェクト Pause 中に止まるため keepalive と相性が悪い
- Materialized View は手動 refresh が必要で、訪問・評価が変わるたびに同期する必要がある
- **結論**：通常の VIEW（`restaurant_rating_summary`）で十分。データ量が少ないので毎クエリ集計してもコストは無視できる

### ORM（Drizzle / Prisma 等）
- バックエンドが無いため、ORM を呼ぶ場所が無い（ブラウザ → Supabase PostgREST が直接アクセス）
- **結論**：`@supabase/supabase-js` のクエリビルダ + `supabase gen types` で型安全性は確保できる

### Edge Function での argon2 / bcrypt
- 守るべきは単一の固定値（合言葉）であり DB のパスワード一覧ではない。レインボーテーブル耐性は salt + SHA-256 で十分
- 外部依存を Edge Function に持ち込まないため、`crypto.subtle.digest('SHA-256', ...)` + 定数時間比較を採用

### `display_name` の Google からの自動同期
- Google 側で姓名を変えるとアプリ側の表示名が勝手に書き換わる挙動になり、ユーザーが嫌がる可能性がある
- **結論**：`display_name` は手動編集を尊重。`avatar_url` だけ自動同期する（`AuthProvider.syncFromAuthMeta`）

## 設計判断のメモ（やる派 / やらない派の根拠）

### 「ジャンル」をユーザー追加可にしている理由
- マスタを固定にすると「ラーメン専門店」「中華」「アジア料理」の粒度問題でケンカになる
- 名前 UNIQUE + NFKC 正規化 + trim で「アジア料理」と「アジア料理 」の重複は防げる
- 同名 race（UNIQUE 違反）はクライアントで「すでに存在します」と表示し refetch して既存を選ばせる

### 価格帯を enum にしている理由（自由入力にしない）
- 「2000円」「2,000円」「￥2,000」のような表記揺れを避ける
- 5 段階固定で集計・フィルタもしやすい
- 変更したくなったら enum を ALTER で増やせばよい（互換性に注意）

### 評価の必須項目化を避けている理由
- 「店舗だけ登録して評価は後で」の運用が想定される
- 訪問なし店舗の登録、訪問あり評価なし、訪問あり評価ありの 3 段階を許容
- それぞれ表示側で「評価なし」バッジを出す

### `restaurants.created_by` を SET NULL にしている理由
- ユーザーが退会しても店舗マスタは共有資産として残る
- 編集権限は無くなる（NULL なので `created_by = auth.uid()` を満たさない）

### `visits.user_id` を CASCADE にしている理由
- 訪問記録は個人の主観評価なので、退会したら本人の記録も消すのが自然

### `genres.created_by` を SET NULL にしている理由
- ジャンルは共有資産。作成者退会でジャンル自体は残す

## ナレッジを残すべき判断ポイント（チェックリスト）

新機能を追加するときに「これは過去に検討して捨てたパターンと衝突しないか」を確認するために：

- [ ] 写真・動画を扱おうとしていないか（Free Tier 容量を理由に却下）
- [ ] スクレイピングや LLM 抽出で外部の客観データを取り込もうとしていないか（ToS / 鮮度劣化を理由に却下）
- [ ] 別 chunk に React 依存パッケージを切り出そうとしていないか（forwardRef 事故を理由に却下）
- [ ] Edge Function に重い暗号ライブラリを足そうとしていないか（標準 `crypto.subtle` で足りるなら不要）
- [ ] 合言葉やパスフレーズを GitHub Secrets / フロント env に入れようとしていないか（Supabase Secrets が唯一の正）
- [ ] 集計（avg / count）をクライアントでループしようとしていないか（VIEW を使う）
- [ ] queryKey を文字列リテラルで書こうとしていないか（`qk` ファクトリ経由）
