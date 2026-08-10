-- StageFlow v6: soundtrack belongs directly to a scene; scene details stay optional.
create extension if not exists pgcrypto;

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
  notion_page_id text,
  notion_last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (production_id, code, title)
);

alter table public.soundtracks add column if not exists notion_page_id text;
alter table public.soundtracks add column if not exists notion_last_edited_at timestamptz;
alter table public.productions add column if not exists notion_data_source_id text;
alter table public.productions add column if not exists notion_last_synced_at timestamptz;

-- Existing summary data remains readable. New and re-imported soundtracks use scene_id only.
update public.soundtracks set scene_detail_id = null where scene_detail_id is not null;

alter table public.scene_details enable row level security;
drop policy if exists scene_details_production_access on public.scene_details;
create policy scene_details_production_access on public.scene_details
for all to authenticated
using (public.stageflow_can_access_production(production_id))
with check (public.stageflow_can_access_production(production_id));
grant select, insert, update, delete on public.scene_details to authenticated;

alter table public.soundtracks enable row level security;
drop policy if exists soundtracks_production_access on public.soundtracks;
create policy soundtracks_production_access on public.soundtracks
for all to authenticated
using (public.stageflow_can_access_production(production_id))
with check (public.stageflow_can_access_production(production_id));
grant select, insert, update, delete on public.soundtracks to authenticated;

create index if not exists soundtracks_scene_order_idx on public.soundtracks(scene_id, sort_order);
create unique index if not exists soundtracks_notion_page_unique
  on public.soundtracks(production_id, notion_page_id)
  where notion_page_id is not null;
