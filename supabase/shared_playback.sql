-- 공연별 실시간 공유 음악 플레이어
-- 단독 실행해도 필요한 공연 멤버십과 접근 함수가 먼저 준비됩니다.

create table if not exists public.production_members (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'editor', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (production_id, user_id)
);

insert into public.production_members (production_id, user_id, role, invited_by)
select p.id, wm.user_id,
  case when p.created_by = wm.user_id then 'owner' else 'member' end,
  p.created_by
from public.productions p
join public.workspace_members wm on wm.workspace_id = p.workspace_id
on conflict (production_id, user_id) do nothing;

create or replace function public.stageflow_can_access_production(target_production_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.production_members pm
    where pm.production_id = target_production_id
      and pm.user_id = auth.uid()
  );
$$;

grant execute on function public.stageflow_can_access_production(uuid) to authenticated;

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
