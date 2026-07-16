create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(), token uuid not null unique default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  production_id uuid references public.productions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  uses integer not null default 0, max_uses integer not null default 100,
  created_at timestamptz not null default now()
);
alter table public.workspace_invites enable row level security;

create or replace function public.create_workspace_invite(target_workspace_id uuid, target_production_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare new_token uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.workspace_members where workspace_id=target_workspace_id and user_id=auth.uid()) then raise exception '이 팀의 초대 권한이 없습니다'; end if;
  insert into public.workspace_invites(workspace_id,production_id,created_by) values(target_workspace_id,target_production_id,auth.uid()) returning token into new_token;
  return new_token::text;
end; $$;

create or replace function public.join_workspace_by_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare found_invite public.workspace_invites%rowtype;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select * into found_invite from public.workspace_invites where token=invite_token::uuid and expires_at>now() and uses<max_uses for update;
  if not found then raise exception '초대 링크가 만료되었거나 유효하지 않습니다'; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(found_invite.workspace_id,auth.uid(),'member') on conflict (workspace_id,user_id) do nothing;
  update public.workspace_invites set uses=uses+1 where id=found_invite.id;
  return found_invite.production_id;
end; $$;
grant execute on function public.create_workspace_invite(uuid,uuid) to authenticated;
grant execute on function public.join_workspace_by_invite(text) to authenticated;
