-- ローカル開発用のテストユーザーを seed する。
-- `supabase db reset` で migrations 適用 → このファイルが実行される。
-- 本番には絶対に走らない（supabase db push は seed.sql を含めない）。
--
-- ユーザー：
--   dev1@local.test / devpass    → 開発ユーザー1
--   dev2@local.test / devpass    → 開発ユーザー2

DO $$
DECLARE
  user1_id  uuid := '00000000-0000-0000-0000-000000000001';
  user2_id  uuid := '00000000-0000-0000-0000-000000000002';
  user1_em  text := 'dev1@local.test';
  user2_em  text := 'dev2@local.test';
  pw_hash   text := crypt('devpass', gen_salt('bf'));
BEGIN
  -- auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', user1_id,
      'authenticated', 'authenticated', user1_em, pw_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"開発ユーザー1"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', user2_id,
      'authenticated', 'authenticated', user2_em, pw_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"開発ユーザー2"}'::jsonb,
      now(), now(), '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

  -- auth.identities（GoTrue が email サインインに必要とする）
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES
    (
      gen_random_uuid(), user1_id, user1_id::text, 'email',
      jsonb_build_object('sub', user1_id::text, 'email', user1_em, 'email_verified', true),
      now(), now(), now()
    ),
    (
      gen_random_uuid(), user2_id, user2_id::text, 'email',
      jsonb_build_object('sub', user2_id::text, 'email', user2_em, 'email_verified', true),
      now(), now(), now()
    )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- 招待制ガードを通過させるため allowed_emails と profiles を直接作成
  INSERT INTO public.allowed_emails (email) VALUES (user1_em), (user2_em)
    ON CONFLICT (email) DO NOTHING;

  INSERT INTO public.profiles (id, display_name) VALUES
    (user1_id, '開発ユーザー1'),
    (user2_id, '開発ユーザー2')
  ON CONFLICT (id) DO NOTHING;
END $$;
