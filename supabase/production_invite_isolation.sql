-- StageFlow: hard separation between productions.
-- Existing workspace-wide membership rows are retained as "legacy" for audit,
-- but they no longer grant access. Reopening a production invite upgrades only
-- that production membership to an active invite grant.

begin;

alter table public.production_members
  add column if not exists access_source text not null default 'legacy';

create index if not exists production_members_access_idx
  on public.production_members(user_id, production_id, access_source);

insert into public.production_members
  (production_id, user_id, role, access_source, invited_by)
select p.id, p.created_by, 'owner', 'owner', p.created_by
from public.productions p
where p.created_by is not null
on conflict (production_id, user_id) do update
set role = 'owner', access_source = 'owner';

update public.production_members pm
set role = 'owner', access_source = 'owner'
from public.productions p
where p.id = pm.production_id
  and p.created_by = pm.user_id;

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

revoke all on function public.stageflow_can_access_production(uuid) from public;
revoke all on function public.stageflow_is_production_owner(uuid) from public;
grant execute on function public.stageflow_can_access_production(uuid) to authenticated;
grant execute on function public.stageflow_is_production_owner(uuid) to authenticated;

create or replace function public.stageflow_add_production_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.production_members
    (production_id, user_id, role, access_source, invited_by)
  values (new.id, new.created_by, 'owner', 'owner', new.created_by)
  on conflict (production_id, user_id) do update
  set role = 'owner', access_source = 'owner';
  return new;
end;
$$;

drop trigger if exists stageflow_production_owner_after_insert on public.productions;
create trigger stageflow_production_owner_after_insert
after insert on public.productions
for each row execute function public.stageflow_add_production_owner();

create or replace function public.join_workspace_by_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare found_invite public.workspace_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into found_invite
  from public.workspace_invites
  where token = invite_token::uuid
    and expires_at > now()
    and uses < max_uses
    and production_id is not null
  for update;

  if not found then
    raise exception '초대 링크가 만료되었거나 유효하지 않습니다.';
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values(found_invite.workspace_id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.production_members
    (production_id, user_id, role, access_source, invited_by)
  values(found_invite.production_id, auth.uid(), 'member', 'invite', found_invite.created_by)
  on conflict (production_id, user_id) do update
  set access_source = 'invite', invited_by = excluded.invited_by;

  update public.workspace_invites
  set uses = uses + 1
  where id = found_invite.id;

  return found_invite.production_id;
end;
$$;

revoke all on function public.join_workspace_by_invite(text) from public;
grant execute on function public.join_workspace_by_invite(text) to authenticated;

commit;
