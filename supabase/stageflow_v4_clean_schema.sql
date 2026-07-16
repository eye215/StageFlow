-- StageFlow DB v4 target schema
-- Additive only: existing data and legacy tables are not deleted.
-- Run production_scoped_access.sql first.

create extension if not exists pgcrypto;

create table if not exists public.production_invites (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses integer not null default 100 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (production_id, name)
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists people_production_name_unique on public.people(production_id, lower(name));

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  parent_role_id uuid references public.roles(id) on delete cascade,
  depth smallint not null check (depth in (1, 2)),
  name text not null,
  role_type text not null default 'role' check (role_type in ('lead', 'support', 'ensemble', 'role')),
  sort_order integer not null default 0,
  check ((depth = 1 and parent_role_id is null) or (depth = 2 and parent_role_id is not null))
);
create unique index if not exists roles_depth1_unique on public.roles(production_id, lower(name)) where depth = 1;
create unique index if not exists roles_depth2_unique on public.roles(production_id, parent_role_id, lower(name)) where depth = 2;

create table if not exists public.cast_assignments (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  is_primary boolean not null default false,
  note text not null default '',
  unique (pair_id, person_id, role_id)
);

create table if not exists public.scene_cast (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  cast_assignment_id uuid not null references public.cast_assignments(id) on delete cascade,
  appearance_type text not null default 'onstage' check (appearance_type in ('main', 'onstage', 'back', 'standby')),
  entrance_note text not null default '',
  exit_note text not null default '',
  unique (scene_id, cast_assignment_id, appearance_type)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  kind text not null check (kind in ('prop', 'set', 'costume')),
  name text not null,
  description text not null default '',
  unique (production_id, kind, name)
);

create table if not exists public.scene_items (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  owner_cast_assignment_id uuid references public.cast_assignments(id) on delete set null,
  in_cast_assignment_id uuid references public.cast_assignments(id) on delete set null,
  out_cast_assignment_id uuid references public.cast_assignments(id) on delete set null,
  timing text not null default '',
  note text not null default '',
  unique (scene_id, item_id)
);

create table if not exists public.numbers (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  code text,
  title text not null,
  sort_order integer not null default 0,
  unique (production_id, title)
);

create table if not exists public.scene_numbers (
  scene_id uuid not null references public.scenes(id) on delete cascade,
  number_id uuid not null references public.numbers(id) on delete cascade,
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (scene_id, number_id)
);

create table if not exists public.cues (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  cue_type text not null check (cue_type in ('light', 'sound', 'video', 'music', 'action')),
  label text not null,
  trigger_text text not null default '',
  sort_order integer not null default 0,
  note text not null default ''
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  category text not null check (category in ('script', 'score', 'music', 'video', 'image', 'other')),
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.number_files (
  number_id uuid not null references public.numbers(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  production_id uuid not null references public.productions(id) on delete cascade,
  purpose text not null default 'reference' check (purpose in ('mr', 'ar', 'guide', 'score', 'reference')),
  sort_order integer not null default 0,
  primary key (number_id, file_id)
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  source_file_id uuid references public.files(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  method text not null check (method in ('pdf_text', 'ocr', 'spreadsheet', 'paste', 'ai')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'review', 'applied', 'failed')),
  merge_mode text not null default 'append' check (merge_mode in ('append', 'merge')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.import_candidates (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  entity_type text not null check (entity_type in ('scene', 'person', 'role', 'number', 'item', 'cue', 'file_link')),
  source_key text,
  candidate_data jsonb not null,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  decision text not null default 'pending' check (decision in ('pending', 'accepted', 'rejected', 'merged')),
  applied_entity_id uuid
);

create table if not exists public.show_sessions (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  pair_id uuid references public.pairs(id) on delete set null,
  session_type text not null check (session_type in ('rehearsal', 'show')),
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  current_scene_id uuid references public.scenes(id) on delete set null
);

create table if not exists public.scene_runs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  unique (session_id, scene_id, started_at)
);

create table if not exists public.readiness_states (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  subject_type text not null check (subject_type in ('cast', 'item', 'number_file')),
  subject_id uuid not null,
  is_ready boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (session_id, scene_id, subject_type, subject_id)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete set null,
  recipient_person_id uuid not null references public.people(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

-- All production-owned tables use the same access rule.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'production_invites','pairs','people','roles','cast_assignments','scene_cast',
    'items','scene_items','numbers','scene_numbers','cues','files','number_files',
    'import_batches','import_candidates','show_sessions','scene_runs','readiness_states','feedback'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_production_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.stageflow_can_access_production(production_id)) with check (public.stageflow_can_access_production(production_id))',
      table_name || '_production_access', table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

-- A recipient can read their own feedback; production members can create feedback.
drop policy if exists feedback_production_access on public.feedback;
drop policy if exists feedback_insert on public.feedback;
drop policy if exists feedback_recipient_read on public.feedback;
create policy feedback_insert on public.feedback
for insert to authenticated
with check (public.stageflow_can_access_production(production_id) and author_user_id = auth.uid());
create policy feedback_recipient_read on public.feedback
for select to authenticated
using (
  exists (
    select 1 from public.people p
    where p.id = feedback.recipient_person_id and p.user_id = auth.uid()
  )
  or author_user_id = auth.uid()
);
