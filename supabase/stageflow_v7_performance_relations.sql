-- StageFlow v7: performance-scoped relationship model
-- Additive migration. Run production_scoped_access.sql, v4 and v5 first.
-- Existing scene_id values on soundtracks are preserved and backfilled into scene_songs.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.soundtracks') is null
    or to_regclass('public.castings') is null
    or to_regclass('public.scenes') is null then
    raise exception 'StageFlow v4/v5 tables are required. Run production_scoped_access.sql, stageflow_v4_clean_schema.sql, and stageflow_v5_master_actor_flow.sql first.';
  end if;
end $$;

-- Song is an independent master record. A scene may use zero or more songs,
-- and the same song may be reused in multiple scenes.
alter table if exists public.soundtracks alter column scene_id drop not null;

create table if not exists public.scene_songs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  song_id uuid not null references public.soundtracks(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (scene_id, song_id)
);

insert into public.scene_songs (production_id, scene_id, song_id, sort_order)
select production_id, scene_id, id, sort_order
from public.soundtracks
where scene_id is not null
on conflict (scene_id, song_id) do update set sort_order = excluded.sort_order;

comment on table public.scene_songs is
  'Scene↔Song N:M 연결. soundtracks.scene_id는 이전 버전 읽기 호환용이며 새 저장은 이 테이블을 사용한다.';

-- Choreography exclusion belongs to a casting and a song, never to a scene.
create table if not exists public.casting_song_settings (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  casting_id uuid not null references public.castings(id) on delete cascade,
  song_id uuid not null references public.soundtracks(id) on delete cascade,
  choreography_excluded boolean not null default false,
  note text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (casting_id, song_id)
);

comment on table public.casting_song_settings is
  '배우별 안무 참여 예외. 기본값은 참여이며 choreography_excluded=true인 음악만 제외한다.';

-- Costume can be attached to a song independently from scene costume.
-- Runtime resolution order: scene_costumes > song_costumes > previous costume.
create table if not exists public.song_costumes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  song_id uuid not null references public.soundtracks(id) on delete cascade,
  costume_item_id uuid not null references public.items(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  actor_id uuid references public.people(id) on delete set null,
  pair_id uuid references public.pairs(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists song_costumes_identity_unique
  on public.song_costumes (
    song_id,
    costume_item_id,
    coalesce(character_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(actor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(pair_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.external_links (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  kind text not null default 'other' check (kind in ('notion','drive','website','other')),
  title text not null,
  url text not null check (url ~* '^https?://'),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.show_sessions add column if not exists current_song_id uuid references public.soundtracks(id) on delete set null;
alter table if exists public.show_sessions add column if not exists audio_output_owner_id uuid references auth.users(id) on delete set null;
alter table if exists public.show_sessions add column if not exists playback_state jsonb not null default '{"status":"paused","position":0}'::jsonb;
alter table if exists public.show_sessions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.run_participants (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  session_id uuid not null references public.show_sessions(id) on delete cascade,
  actor_id uuid not null references public.people(id) on delete cascade,
  is_participating boolean not null default true,
  selected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, actor_id)
);

create index if not exists scene_songs_scene_order_idx on public.scene_songs(scene_id, sort_order);
create index if not exists scene_songs_song_idx on public.scene_songs(song_id);
create index if not exists casting_song_settings_casting_idx on public.casting_song_settings(casting_id);
create index if not exists run_participants_session_idx on public.run_participants(session_id);
create index if not exists external_links_production_order_idx on public.external_links(production_id, sort_order);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'scene_songs','casting_song_settings','song_costumes','external_links','run_participants'
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

