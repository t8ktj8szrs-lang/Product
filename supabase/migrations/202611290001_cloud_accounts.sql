-- Budgtree cloud accounts and per-user finance storage.
-- Safe to run on an existing project: it does not delete users or user_data rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text,
  student_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists user_data_user_id_unique on public.user_data(user_id);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

drop policy if exists "Students can read their own profile" on public.profiles;
create policy "Students can read their own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "Students can update their own profile" on public.profiles;
create policy "Students can update their own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Students can read their own data" on public.user_data;
create policy "Students can read their own data" on public.user_data
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Students can insert their own data" on public.user_data;
create policy "Students can insert their own data" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Students can update their own data" on public.user_data;
create policy "Students can update their own data" on public.user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Students can delete their own data" on public.user_data;
create policy "Students can delete their own data" on public.user_data
  for delete to authenticated using (auth.uid() = user_id);

-- Keep a private profile index synchronized with Supabase Auth metadata.
create or replace function public.budgtree_sync_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_student_id text;
begin
  v_username := nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username', ''))), '');
  v_student_id := nullif(lower(trim(coalesce(new.raw_user_meta_data->>'student_id', ''))), '');

  -- Preserve account creation/update even if legacy metadata duplicates an identifier.
  if v_username is not null and exists (
    select 1 from public.profiles p where lower(p.username) = v_username and p.id <> new.id
  ) then v_username := null; end if;
  if v_student_id is not null and exists (
    select 1 from public.profiles p where lower(p.student_id) = v_student_id and p.id <> new.id
  ) then v_student_id := null; end if;

  insert into public.profiles (id, full_name, username, student_id, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_username,
    v_student_id,
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    username = coalesce(excluded.username, public.profiles.username),
    student_id = coalesce(excluded.student_id, public.profiles.student_id),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists budgtree_auth_user_profile on auth.users;
create trigger budgtree_auth_user_profile
after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.budgtree_sync_profile();

-- Backfill profiles for accounts that already exist. If old metadata contains duplicate
-- usernames/student numbers, leave those duplicate lookup fields blank rather than failing
-- the migration or assigning one identifier to multiple accounts. Email login remains available.
with source_users as (
  select
    u.id,
    coalesce(u.raw_user_meta_data->>'full_name', '') as full_name,
    nullif(lower(trim(coalesce(u.raw_user_meta_data->>'username', ''))), '') as username,
    nullif(lower(trim(coalesce(u.raw_user_meta_data->>'student_id', ''))), '') as student_id
  from auth.users u
), counted as (
  select *,
    count(username) over (partition by username) as username_count,
    count(student_id) over (partition by student_id) as student_count
  from source_users
)
insert into public.profiles (id, full_name, username, student_id)
select id, full_name,
  case when username_count = 1 then username else null end,
  case when student_count = 1 then student_id else null end
from counted
on conflict (id) do update set
  full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
  username = coalesce(public.profiles.username, excluded.username),
  student_id = coalesce(public.profiles.student_id, excluded.student_id),
  updated_at = now();

-- Existing profile rows may also contain duplicate identifiers. Keep the first row and
-- clear duplicate lookup values for the others; no account or financial record is deleted.
with ranked as (
  select id, row_number() over (partition by lower(username) order by created_at, id) as rn
  from public.profiles where username is not null and length(trim(username)) > 0
)
update public.profiles p set username = null from ranked r where p.id = r.id and r.rn > 1;
with ranked as (
  select id, row_number() over (partition by lower(student_id) order by created_at, id) as rn
  from public.profiles where student_id is not null and length(trim(student_id)) > 0
)
update public.profiles p set student_id = null from ranked r where p.id = r.id and r.rn > 1;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null and length(trim(username)) > 0;
create unique index if not exists profiles_student_id_lower_unique
  on public.profiles (lower(student_id)) where student_id is not null and length(trim(student_id)) > 0;
