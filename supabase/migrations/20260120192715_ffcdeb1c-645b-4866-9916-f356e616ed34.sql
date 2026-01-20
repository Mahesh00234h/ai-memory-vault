-- V2 backend MVP: projects + memories

-- 1) Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  team_id uuid null,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects (user_id);
create index if not exists idx_projects_team_id on public.projects (team_id);

alter table public.projects enable row level security;

create policy "Users can read own projects"
on public.projects
for select
using (auth.uid() = user_id);

create policy "Users can create own projects"
on public.projects
for insert
with check (auth.uid() = user_id);

create policy "Users can update own projects"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own projects"
on public.projects
for delete
using (auth.uid() = user_id);

-- updated_at trigger
create trigger update_projects_updated_at
before update on public.projects
for each row
execute function public.update_updated_at_column();


-- 2) Memories
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  team_id uuid null,
  project_id uuid null,

  source_platform text null,
  source_url text null,
  source_thread_key text null,
  source_page_title text null,
  source_captured_at timestamptz null,

  raw_text text null,

  title text not null,
  topic text null,
  summary text null,
  key_points jsonb null default '[]'::jsonb,
  decisions jsonb null default '[]'::jsonb,
  open_questions jsonb null default '[]'::jsonb,

  content_hash text null,
  message_count integer null default 0,
  memory_version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memories_user_id on public.memories (user_id);
create index if not exists idx_memories_project_id on public.memories (project_id);
create index if not exists idx_memories_team_id on public.memories (team_id);
create index if not exists idx_memories_thread_key on public.memories (source_thread_key);
create index if not exists idx_memories_content_hash on public.memories (content_hash);

alter table public.memories enable row level security;

create policy "Users can read own memories"
on public.memories
for select
using (auth.uid() = user_id);

create policy "Users can create own memories"
on public.memories
for insert
with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  )
);

create policy "Users can update own memories"
on public.memories
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  )
);

create policy "Users can delete own memories"
on public.memories
for delete
using (auth.uid() = user_id);

-- updated_at trigger
create trigger update_memories_updated_at
before update on public.memories
for each row
execute function public.update_updated_at_column();
