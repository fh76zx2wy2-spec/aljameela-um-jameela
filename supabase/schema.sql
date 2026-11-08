-- Keep this in a dedicated Supabase project. No journal/diary/medical notes leave the device.
create table if not exists public.umj_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  due_date date not null,
  timezone text not null default 'Asia/Riyadh',
  last_notified_week smallint,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.umj_push_subscriptions enable row level security;
-- Client browser never gets direct read/write access to endpoints or due dates.
revoke all on table public.umj_push_subscriptions from anon, authenticated;
grant select,insert,update,delete on table public.umj_push_subscriptions to service_role;
create index if not exists umj_push_enabled_idx on public.umj_push_subscriptions(enabled, due_date);
