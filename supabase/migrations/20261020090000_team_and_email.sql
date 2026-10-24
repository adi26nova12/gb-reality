-- Team management and optional email delivery for notifications.
--
-- Membership changes now go only through the functions below, which enforce:
--   * only owners and admins manage members;
--   * only owners can grant, change or remove the owner role;
--   * an organisation always keeps at least one owner.
-- These are SECURITY DEFINER because looking a user up by email needs
-- auth.users, which signed-in users cannot read. Each function checks the
-- caller's role explicitly before doing anything.

drop policy if exists "Admins add members" on public.organisation_memberships;
drop policy if exists "Admins remove members" on public.organisation_memberships;
revoke insert, delete on public.organisation_memberships from authenticated;

-- ---------------------------------------------------------------------------
-- Team management
-- ---------------------------------------------------------------------------

create or replace function public.add_organisation_member(p_org uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.has_org_role(p_org, array['owner', 'admin']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'agent') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if p_role = 'owner' and not public.has_org_role(p_org, array['owner']) then
    raise exception 'only_owners_manage_owners' using errcode = '42501';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, email) values (v_user, v_email) on conflict (id) do nothing;
  insert into public.organisation_memberships (organisation_id, user_id, role)
  values (p_org, v_user, p_role)
  on conflict (organisation_id, user_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'already_member' using errcode = '23505';
  end if;
  return v_id;
end;
$$;

create or replace function public.set_organisation_member_role(p_org uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.has_org_role(p_org, array['owner', 'admin']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'agent') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select m.role into v_current
  from public.organisation_memberships m
  where m.organisation_id = p_org and m.user_id = p_user
  for update;
  if v_current is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_current = p_role then
    return;
  end if;
  if (v_current = 'owner' or p_role = 'owner') and not public.has_org_role(p_org, array['owner']) then
    raise exception 'only_owners_manage_owners' using errcode = '42501';
  end if;
  if v_current = 'owner' and (
    select count(*) from public.organisation_memberships m where m.organisation_id = p_org and m.role = 'owner'
  ) <= 1 then
    raise exception 'last_owner' using errcode = '22023';
  end if;

  update public.organisation_memberships set role = p_role
  where organisation_id = p_org and user_id = p_user;
end;
$$;

create or replace function public.remove_organisation_member(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.has_org_role(p_org, array['owner', 'admin']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select m.role into v_current
  from public.organisation_memberships m
  where m.organisation_id = p_org and m.user_id = p_user
  for update;
  if v_current is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_current = 'owner' and not public.has_org_role(p_org, array['owner']) then
    raise exception 'only_owners_manage_owners' using errcode = '42501';
  end if;
  if v_current = 'owner' and (
    select count(*) from public.organisation_memberships m where m.organisation_id = p_org and m.role = 'owner'
  ) <= 1 then
    raise exception 'last_owner' using errcode = '22023';
  end if;

  -- Their enquiries become unassigned so nothing is left with a former member.
  update public.leads set assigned_agent_id = null
  where organisation_id = p_org and assigned_agent_id = p_user;
  delete from public.organisation_memberships where organisation_id = p_org and user_id = p_user;
end;
$$;

revoke execute on function public.add_organisation_member(uuid, text, text) from public, anon;
revoke execute on function public.set_organisation_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_organisation_member(uuid, uuid) from public, anon;
grant execute on function public.add_organisation_member(uuid, text, text) to authenticated;
grant execute on function public.set_organisation_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_organisation_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Email delivery for notifications (optional)
-- ---------------------------------------------------------------------------

-- Members opt in to emails; off by default.
alter table public.organisation_memberships add column notify_email boolean not null default false;
grant update (notify_email) on public.organisation_memberships to authenticated;

-- 'accepted' means the email provider accepted the message. It does not
-- mean the email was delivered or read.
alter table public.notifications
  add column email_status text not null default 'not_sent'
    check (email_status in ('not_sent', 'sending', 'accepted', 'failed', 'skipped')),
  add column email_provider_id text,
  add column email_error text check (email_error is null or char_length(email_error) <= 200),
  add column email_updated_at timestamptz;

-- Atomically claims a notification for emailing, so a webhook retry can never
-- send it twice. Returns nothing when there is nothing to send, and marks the
-- notification 'skipped' when the recipient has not opted in or has no email.
create or replace function public.claim_notification_email(p_notification_id uuid)
returns table (recipient_email text, recipient_name text, title text, body text, lead_id uuid, organisation_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  v_opted_in boolean;
  v_email text;
  v_name text;
  v_org_name text;
begin
  update public.notifications
  set email_status = 'sending', email_updated_at = now()
  where id = p_notification_id and email_status = 'not_sent'
  returning * into n;
  if not found then
    return;
  end if;

  select m.notify_email into v_opted_in
  from public.organisation_memberships m
  where m.organisation_id = n.organisation_id and m.user_id = n.recipient_id;
  select p.email, p.full_name into v_email, v_name from public.profiles p where p.id = n.recipient_id;
  select o.name into v_org_name from public.organisations o where o.id = n.organisation_id;

  if not coalesce(v_opted_in, false) or v_email is null then
    update public.notifications set email_status = 'skipped', email_updated_at = now() where id = n.id;
    return;
  end if;

  return query select v_email, v_name, n.title, n.body, n.lead_id, v_org_name;
end;
$$;

create or replace function public.complete_notification_email(
  p_notification_id uuid,
  p_status text,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('accepted', 'failed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.notifications
  set email_status = p_status,
      email_provider_id = left(p_provider_id, 200),
      email_error = left(p_error, 200),
      email_updated_at = now()
  where id = p_notification_id and email_status = 'sending';
end;
$$;

-- Only the server-side webhook (service role) may claim or complete emails.
revoke execute on function public.claim_notification_email(uuid) from public, anon, authenticated;
revoke execute on function public.complete_notification_email(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_notification_email(uuid) to service_role;
grant execute on function public.complete_notification_email(uuid, text, text, text) to service_role;
