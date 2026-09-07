-- Story Bank — database schema
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor → New query).
-- It creates one table for your stories and locks it down so only the
-- signed-in owner of a row can ever see or touch it (Row Level Security).

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  tags text[] not null default '{}',
  answers_for text not null default '',
  anchor text not null default '',
  script text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_user_id_idx on stories(user_id);

alter table stories enable row level security;

drop policy if exists "select own stories" on stories;
create policy "select own stories"
  on stories for select
  using (auth.uid() = user_id);

drop policy if exists "insert own stories" on stories;
create policy "insert own stories"
  on stories for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own stories" on stories;
create policy "update own stories"
  on stories for update
  using (auth.uid() = user_id);

drop policy if exists "delete own stories" on stories;
create policy "delete own stories"
  on stories for delete
  using (auth.uid() = user_id);

-- Keep updated_at current on every edit.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists stories_set_updated_at on stories;
create trigger stories_set_updated_at
  before update on stories
  for each row
  execute function set_updated_at();
