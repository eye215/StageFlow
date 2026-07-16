-- 공연별 실시간 공유 음악 플레이어
-- production_scoped_access.sql 실행 후 적용하세요.

create table if not exists public.production_playback (
  production_id uuid primary key references public.productions(id) on delete cascade,
  file_path text not null default '',
  file_name text not null default '',
  scene_no numeric,
  is_playing boolean not null default false,
  position_seconds double precision not null default 0 check (position_seconds >= 0),
  command_seq bigint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.production_playback enable row level security;
drop policy if exists production_playback_member_access on public.production_playback;
create policy production_playback_member_access on public.production_playback
for all to authenticated
using (public.stageflow_can_access_production(production_id))
with check (public.stageflow_can_access_production(production_id));
grant select, insert, update, delete on public.production_playback to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'production_playback'
  ) then
    alter publication supabase_realtime add table public.production_playback;
  end if;
end $$;
