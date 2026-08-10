-- StageFlow v5: Master setup -> Invite -> Actor claim -> Run Pair -> Scene
-- Additive migration. Existing v4 tables and JSON files remain readable.

create extension if not exists pgcrypto;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  parent_character_id uuid references public.characters(id) on delete set null,
  name text not null,
  depth smallint not null default 1 check (depth in (1, 2)),
  character_type text not null default 'role' check (character_type in ('lead','support','ensemble','role')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists characters_production_parent_name_unique
  on public.characters(production_id, coalesce(parent_character_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table if not exists public.castings (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  actor_id uuid not null references public.people(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (pair_id, actor_id, character_id)
);

create table if not exists public.actor_claims (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  actor_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (production_id, actor_id),
  unique (production_id, user_id)
);

create table if not exists public.scene_details (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  code text not null,
  title text not null default '',
  sort_order integer not null default 0,
  note text not null default '',
  unique (scene_id, code)
);

create table if not exists public.soundtracks (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  scene_detail_id uuid references public.scene_details(id) on delete set null,
  code text,
  title text not null,
  sort_order integer not null default 0,
  unique (production_id, code, title)
);

create table if not exists public.scene_characters (
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  appearance_type text not null default 'onstage' check (appearance_type in ('main','onstage','standby')),
  entrance_note text not null default '',
  exit_note text not null default '',
  primary key (scene_id, character_id, appearance_type)
);

create table if not exists public.scene_costumes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  costume_item_id uuid not null references public.items(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  actor_id uuid references public.people(id) on delete set null,
  pair_id uuid references public.pairs(id) on delete set null,
  note text not null default '',
  unique (scene_id, costume_item_id, character_id, actor_id, pair_id)
);

create table if not exists public.run_pair_selections (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  session_id uuid references public.show_sessions(id) on delete cascade,
  pair_id uuid not null references public.pairs(id) on delete cascade,
  selected_by uuid references auth.users(id) on delete set null,
  selected_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'characters','castings','actor_claims','scene_details','soundtracks',
    'scene_characters','scene_costumes','run_pair_selections'
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

-- Actors may claim only an unclaimed actor prepared by the Master.
drop policy if exists actor_claims_production_access on public.actor_claims;
drop policy if exists actor_claims_select on public.actor_claims;
drop policy if exists actor_claims_insert on public.actor_claims;
create policy actor_claims_select on public.actor_claims for select to authenticated
using (public.stageflow_can_access_production(production_id));
create policy actor_claims_insert on public.actor_claims for insert to authenticated
with check (
  user_id = auth.uid()
  and public.stageflow_can_access_production(production_id)
  and exists (select 1 from public.people p where p.id = actor_id and p.production_id = actor_claims.production_id)
);
