-- StageFlow: 공연별 멤버십과 초대 권한 분리
-- 기존 데이터는 유지하고, 앞으로의 초대는 선택한 공연 하나에만 접근 권한을 줍니다.

create table if not exists public.production_members (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'editor', 'member')),
  access_source text not null default 'legacy',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (production_id, user_id)
);

alter table public.production_members
  add column if not exists access_source text not null default 'legacy';

create index if not exists production_members_user_idx
  on public.production_members(user_id, production_id);

-- 기존 workspace 멤버는 현재 존재하는 공연에만 이관합니다.
-- 이관 이후 새 초대는 join_workspace_by_invite 함수가 선택한 공연 한 곳에만 추가합니다.
insert into public.production_members (production_id, user_id, role, access_source, invited_by)
select
  p.id,
  p.created_by,
  'owner',
  'owner',
  p.created_by
from public.productions p
where p.created_by is not null
on conflict (production_id, user_id) do update
set role = 'owner', access_source = 'owner';

update public.production_members pm
set role = 'owner', access_source = 'owner'
from public.productions p
where p.id = pm.production_id and p.created_by = pm.user_id;

create or replace function public.stageflow_can_access_production(target_production_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.production_members pm
    where pm.production_id = target_production_id
      and pm.user_id = auth.uid()
      and pm.access_source in ('owner', 'invite', 'manual')
  );
$$;

create or replace function public.stageflow_is_production_owner(target_production_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.production_members pm
    where pm.production_id = target_production_id
      and pm.user_id = auth.uid()
      and pm.role = 'owner'
      and pm.access_source in ('owner', 'manual')
  );
$$;

grant execute on function public.stageflow_can_access_production(uuid) to authenticated;
grant execute on function public.stageflow_is_production_owner(uuid) to authenticated;
revoke all on function public.stageflow_can_access_production(uuid) from public;
revoke all on function public.stageflow_is_production_owner(uuid) from public;

-- 공연 생성자는 자동으로 그 공연의 owner가 됩니다.
create or replace function public.stageflow_add_production_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.production_members (production_id, user_id, role, access_source, invited_by)
  values (new.id, new.created_by, 'owner', 'owner', new.created_by)
  on conflict (production_id, user_id) do update set role = 'owner', access_source = 'owner';
  return new;
end;
$$;

drop trigger if exists stageflow_production_owner_after_insert on public.productions;
create trigger stageflow_production_owner_after_insert
after insert on public.productions
for each row execute function public.stageflow_add_production_owner();

revoke all on function public.stageflow_add_production_owner() from public;

alter table public.production_members enable row level security;

drop policy if exists production_members_read on public.production_members;
create policy production_members_read on public.production_members
for select to authenticated
using (public.stageflow_can_access_production(production_id));

drop policy if exists production_members_owner_manage on public.production_members;
create policy production_members_owner_manage on public.production_members
for all to authenticated
using (public.stageflow_is_production_owner(production_id))
with check (public.stageflow_is_production_owner(production_id));

grant select on public.production_members to authenticated;

-- 기존의 workspace 단위 정책을 제거하고 공연 멤버십 기준으로 다시 만듭니다.
do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'productions'
  loop execute format('drop policy if exists %I on public.productions', policy_row.policyname); end loop;
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'scenes'
  loop execute format('drop policy if exists %I on public.scenes', policy_row.policyname); end loop;
end $$;

alter table public.productions enable row level security;
alter table public.scenes enable row level security;

create policy productions_member_read on public.productions
for select to authenticated
using (public.stageflow_can_access_production(id));

create policy productions_workspace_create on public.productions
for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = productions.workspace_id and wm.user_id = auth.uid()
  )
);

create policy productions_member_update on public.productions
for update to authenticated
using (public.stageflow_can_access_production(id))
with check (public.stageflow_can_access_production(id));

create policy productions_owner_delete on public.productions
for delete to authenticated
using (public.stageflow_is_production_owner(id));

create policy scenes_production_member_access on public.scenes
for all to authenticated
using (public.stageflow_can_access_production(production_id))
with check (public.stageflow_can_access_production(production_id));

-- 초대 생성: 초대한 사람이 해당 공연 멤버이며 workspace/production 조합이 맞아야 합니다.
-- 이전 설치에서 초대 테이블이 없거나 production_id가 없었던 경우도 이 파일 하나로 복구합니다.
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  production_id uuid references public.productions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  uses integer not null default 0,
  max_uses integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.workspace_invites
  add column if not exists production_id uuid references public.productions(id) on delete cascade;

alter table public.workspace_invites enable row level security;

create or replace function public.create_workspace_invite(target_workspace_id uuid, target_production_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare new_token uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if target_production_id is null then raise exception '초대할 공연을 선택해 주세요'; end if;
  if not exists (
    select 1 from public.productions p
    where p.id = target_production_id and p.workspace_id = target_workspace_id
  ) then raise exception '공연과 공연팀 정보가 일치하지 않습니다'; end if;
  if not public.stageflow_can_access_production(target_production_id) then
    raise exception '이 공연의 초대 권한이 없습니다';
  end if;

  insert into public.workspace_invites(workspace_id, production_id, created_by)
  values(target_workspace_id, target_production_id, auth.uid())
  returning token into new_token;
  return new_token::text;
end;
$$;

-- 초대 참가: workspace는 컨테이너 탐색용, 실제 접근 권한은 production_members 한 곳에만 부여합니다.
create or replace function public.join_workspace_by_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare found_invite public.workspace_invites%rowtype;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select * into found_invite
  from public.workspace_invites
  where token = invite_token::uuid and expires_at > now() and uses < max_uses
  for update;
  if not found then raise exception '초대 링크가 만료되었거나 유효하지 않습니다'; end if;
  if found_invite.production_id is null then raise exception '공연이 지정되지 않은 이전 초대 링크입니다'; end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values(found_invite.workspace_id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.production_members(production_id, user_id, role, access_source, invited_by)
  values(found_invite.production_id, auth.uid(), 'member', 'invite', found_invite.created_by)
  on conflict (production_id, user_id) do update
  set access_source = 'invite', invited_by = excluded.invited_by;

  update public.workspace_invites set uses = uses + 1 where id = found_invite.id;
  return found_invite.production_id;
end;
$$;

grant execute on function public.create_workspace_invite(uuid, uuid) to authenticated;
grant execute on function public.join_workspace_by_invite(text) to authenticated;
revoke all on function public.create_workspace_invite(uuid, uuid) from public;
revoke all on function public.join_workspace_by_invite(text) from public;

-- Storage도 경로의 두 번째 값(production_id)을 검사합니다.
-- 경로 규칙: {workspace_id}/{production_id}/...
create or replace function public.stageflow_storage_production_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 2)::uuid
    else null
  end;
$$;

-- stageflow-files 버킷에 적용된 이전의 workspace 단위 정책만 제거합니다.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%stageflow-files%' or coalesce(with_check, '') like '%stageflow-files%')
  loop
    execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
  end loop;
end $$;

create policy stageflow_files_production_read on storage.objects
for select to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (
    split_part(name, '/', 3) <> 'feedback'
    or split_part(name, '/', 4) = auth.uid()::text
    or owner_id = auth.uid()::text
  )
);

create policy stageflow_files_production_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
);

create policy stageflow_files_production_update on storage.objects
for update to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
)
with check (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
);

create policy stageflow_files_production_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'stageflow-files'
  and public.stageflow_can_access_production(public.stageflow_storage_production_id(name))
  and (split_part(name, '/', 3) <> 'feedback' or owner_id = auth.uid()::text)
);
