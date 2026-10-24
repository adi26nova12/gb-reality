-- Clannco Property Engagement Platform — initial schema
--
-- Every business table carries organisation_id. Cross-table references use
-- composite foreign keys (id, organisation_id) so a row can never point at a
-- record that belongs to a different organisation, even if application code
-- has a bug. Row Level Security limits authenticated users to organisations
-- they are members of. Anonymous buyers never touch tables directly: they go
-- through the SECURITY DEFINER functions at the bottom of this file, which
-- look microsites up by token hash and return only presentation data.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rows must never move between organisations after creation.
create or replace function public.prevent_organisation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id then
    raise exception 'organisation_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations, profiles, memberships
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  -- Random storage folder name so public media URLs never reveal internal IDs.
  media_prefix text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  timezone text not null default 'Asia/Kolkata',
  default_currency char(3) not null default 'INR' check (default_currency ~ '^[A-Z]{3}$'),
  default_country_code char(2) not null default 'IN' check (default_country_code ~ '^[A-Z]{2}$'),
  privacy_contact_email text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  email text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'agent' check (role in ('owner', 'admin', 'agent')),
  notify_first_open boolean not null default true,
  notify_viewing_request boolean not null default true,
  notify_contact_request boolean not null default true,
  notify_engagement boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);
create index organisation_memberships_user_idx on public.organisation_memberships (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY DEFINER so policies can call them without recursing through RLS.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_memberships m
    where m.organisation_id = org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(org uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_memberships m
    where m.organisation_id = org
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

create or replace function public.shares_org_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships mine
    join public.organisation_memberships theirs on theirs.organisation_id = mine.organisation_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  );
$$;

create or replace function public.is_media_prefix_member(prefix text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisations o
    join public.organisation_memberships m on m.organisation_id = o.id
    where o.media_prefix = prefix and m.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Catalogue: developments, properties, brochures
-- ---------------------------------------------------------------------------

create table public.developments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  developer_name text check (developer_name is null or char_length(developer_name) <= 120),
  description text check (description is null or char_length(description) <= 4000),
  location text check (location is null or char_length(location) <= 160),
  address text check (address is null or char_length(address) <= 400),
  map_url text check (map_url is null or map_url ~* '^https://'),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  cover_image_path text,
  gallery_paths text[] not null default '{}',
  amenities text[] not null default '{}',
  -- [{ "label": "On booking", "value": "10%" }, ...]
  payment_plan jsonb not null default '[]'::jsonb check (jsonb_typeof(payment_plan) = 'array'),
  payment_plan_notes text check (payment_plan_notes is null or char_length(payment_plan_notes) <= 1000),
  contact_name text,
  contact_phone_e164 text check (contact_phone_e164 is null or contact_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  contact_email text,
  availability_status text not null default 'available'
    check (availability_status in ('upcoming', 'available', 'limited', 'sold_out')),
  is_sample boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (organisation_id, name)
);
create index developments_org_idx on public.developments (organisation_id) where archived_at is null;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  development_id uuid not null,
  unit_reference text not null check (char_length(btrim(unit_reference)) between 1 and 40),
  configuration text not null check (configuration in (
    'Studio', '1BHK', '1.5BHK', '2BHK', '2.5BHK', '3BHK', '3.5BHK', '4BHK', '5BHK', 'Penthouse', 'Villa', 'Plot', 'Other'
  )),
  property_type text not null default 'apartment'
    check (property_type in ('apartment', 'villa', 'penthouse', 'townhouse', 'plot', 'other')),
  bedrooms smallint check (bedrooms between 0 and 20),
  bathrooms smallint check (bathrooms between 0 and 20),
  area numeric(10, 2) check (area > 0),
  area_unit text not null default 'sqft' check (area_unit in ('sqft', 'sqm')),
  price numeric(14, 2) check (price >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  floor smallint check (floor between -5 and 250),
  floor_plan_path text,
  image_paths text[] not null default '{}',
  description text check (description is null or char_length(description) <= 4000),
  features text[] not null default '{}',
  availability_status text not null default 'available'
    check (availability_status in ('available', 'reserved', 'sold', 'unavailable')),
  payment_plan jsonb check (payment_plan is null or jsonb_typeof(payment_plan) = 'array'),
  is_sample boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (development_id, organisation_id)
    references public.developments (id, organisation_id) on delete cascade,
  unique (id, organisation_id),
  unique (development_id, unit_reference)
);
create index properties_matching_idx
  on public.properties (organisation_id, development_id, configuration, availability_status)
  where archived_at is null;

create table public.brochure_assets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  development_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  storage_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  mime_type text not null check (mime_type = 'application/pdf'),
  allow_download boolean not null default true,
  is_sample boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (development_id, organisation_id)
    references public.developments (id, organisation_id) on delete cascade
);
create index brochure_assets_development_idx on public.brochure_assets (development_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- Enquiries (leads)
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  development_id uuid not null,
  buyer_name text not null check (char_length(btrim(buyer_name)) between 1 and 120),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  configuration text not null check (configuration in (
    'Studio', '1BHK', '1.5BHK', '2BHK', '2.5BHK', '3BHK', '3.5BHK', '4BHK', '5BHK', 'Penthouse', 'Villa', 'Plot', 'Other'
  )),
  budget_min numeric(14, 2) check (budget_min >= 0),
  budget_max numeric(14, 2) check (budget_max >= 0),
  budget_currency char(3) not null default 'INR' check (budget_currency ~ '^[A-Z]{3}$'),
  preferred_location text check (preferred_location is null or char_length(preferred_location) <= 160),
  bedrooms smallint check (bedrooms between 0 and 20),
  preferred_floor text check (preferred_floor is null or char_length(preferred_floor) <= 60),
  property_type text check (property_type is null or property_type in ('apartment', 'villa', 'penthouse', 'townhouse', 'plot', 'other')),
  purchase_timeframe text check (purchase_timeframe is null or purchase_timeframe in (
    'immediate', '1_3_months', '3_6_months', '6_12_months', '12_plus_months', 'undecided'
  )),
  assigned_agent_id uuid references public.profiles (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 4000),
  contact_preference text not null default 'whatsapp' check (contact_preference in ('whatsapp', 'phone', 'email')),
  status text not null default 'new' check (status in (
    'new', 'microsite_generated', 'contacted', 'engaged', 'viewing_requested', 'viewing_scheduled', 'converted', 'lost'
  )),
  contacted_at timestamptz,
  last_engagement_at timestamptz,
  is_sample boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max),
  foreign key (development_id, organisation_id)
    references public.developments (id, organisation_id) on delete restrict,
  unique (id, organisation_id)
);
create index leads_org_created_idx on public.leads (organisation_id, created_at desc);
create index leads_org_status_idx on public.leads (organisation_id, status);
create index leads_org_phone_idx on public.leads (organisation_id, phone_e164);
create index leads_assigned_agent_idx on public.leads (assigned_agent_id);

-- The assigned agent must belong to the lead's organisation.
create or replace function public.check_lead_agent_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_agent_id is not null and not exists (
    select 1 from public.organisation_memberships m
    where m.organisation_id = new.organisation_id and m.user_id = new.assigned_agent_id
  ) then
    raise exception 'assigned agent is not a member of this organisation' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Microsites
-- ---------------------------------------------------------------------------

create table public.microsites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  lead_id uuid not null,
  -- SHA-256 of the public token. Public lookups only ever use the hash.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- AES-256-GCM ciphertext of the token so agents can copy the link again
  -- later. The key lives only in the server environment (MICROSITE_TOKEN_SECRET).
  token_ciphertext text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  intro_message text check (intro_message is null or char_length(intro_message) <= 600),
  show_buyer_name boolean not null default true,
  first_opened_at timestamptz,
  last_activity_at timestamptz,
  whatsapp_initiated_at timestamptz,
  message_sent_confirmed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lead_id, organisation_id) references public.leads (id, organisation_id) on delete cascade,
  unique (id, organisation_id)
);
create unique index microsites_one_active_per_lead on public.microsites (lead_id) where revoked_at is null;
create index microsites_org_created_idx on public.microsites (organisation_id, created_at desc);

create table public.microsite_properties (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  microsite_id uuid not null,
  property_id uuid not null,
  -- Short random reference used by the public page instead of internal IDs.
  public_ref text not null default encode(extensions.gen_random_bytes(5), 'hex'),
  position smallint not null default 0,
  match_tier text not null default 'manual' check (match_tier in ('exact', 'close', 'other', 'manual')),
  -- What the buyer was shown at selection time, kept for historical reporting.
  snapshot jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  foreign key (microsite_id, organisation_id) references public.microsites (id, organisation_id) on delete cascade,
  foreign key (property_id, organisation_id) references public.properties (id, organisation_id) on delete restrict,
  unique (microsite_id, public_ref)
);
create unique index microsite_properties_active_idx
  on public.microsite_properties (microsite_id, property_id) where removed_at is null;
create index microsite_properties_property_idx on public.microsite_properties (property_id);

-- ---------------------------------------------------------------------------
-- Engagement, viewing requests, notifications
-- ---------------------------------------------------------------------------

create table public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  lead_id uuid not null,
  microsite_id uuid,
  event_type text not null check (event_type in (
    -- buyer events (recorded only through record_microsite_event / submit_viewing_request)
    'microsite_opened', 'property_viewed', 'property_details_opened', 'floor_plan_opened',
    'brochure_opened', 'brochure_page_viewed', 'brochure_download_requested', 'brochure_closed',
    'payment_plan_opened', 'map_opened', 'whatsapp_clicked', 'viewing_request_started',
    'viewing_request_submitted',
    -- agent events
    'lead_created', 'microsite_generated', 'microsite_selection_updated', 'microsite_revoked',
    'whatsapp_initiated', 'marked_contacted', 'lead_status_changed', 'viewing_status_changed'
  )),
  actor text not null check (actor in ('buyer', 'agent', 'system')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  property_id uuid,
  -- Random per-tab ID generated in the buyer's browser (sessionStorage). Not a fingerprint.
  session_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  foreign key (lead_id, organisation_id) references public.leads (id, organisation_id) on delete cascade,
  foreign key (microsite_id, organisation_id) references public.microsites (id, organisation_id) on delete cascade,
  foreign key (property_id, organisation_id) references public.properties (id, organisation_id) on delete set null (property_id)
);
create index engagement_events_lead_idx on public.engagement_events (lead_id, occurred_at desc);
create index engagement_events_microsite_idx on public.engagement_events (microsite_id, occurred_at desc);
create index engagement_events_org_idx on public.engagement_events (organisation_id, occurred_at desc);
create index engagement_events_dedupe_idx
  on public.engagement_events (microsite_id, session_id, event_type, occurred_at desc);

create table public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  microsite_id uuid not null,
  lead_id uuid not null,
  property_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  preferred_date date not null,
  preferred_time_range text not null check (preferred_time_range in ('morning', 'afternoon', 'evening')),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'requested' check (status in (
    'requested', 'contacted', 'confirmed', 'rescheduled', 'completed', 'cancelled'
  )),
  scheduled_for timestamptz,
  agent_notes text check (agent_notes is null or char_length(agent_notes) <= 2000),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('confirmed', 'rescheduled') or scheduled_for is not null),
  foreign key (microsite_id, organisation_id) references public.microsites (id, organisation_id) on delete cascade,
  foreign key (lead_id, organisation_id) references public.leads (id, organisation_id) on delete cascade,
  foreign key (property_id, organisation_id) references public.properties (id, organisation_id) on delete set null (property_id)
);
create index viewing_requests_org_idx on public.viewing_requests (organisation_id, created_at desc);
create index viewing_requests_lead_idx on public.viewing_requests (lead_id);
create index viewing_requests_microsite_idx on public.viewing_requests (microsite_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('microsite_first_open', 'viewing_request', 'contact_request', 'engagement')),
  title text not null,
  body text,
  lead_id uuid references public.leads (id) on delete cascade,
  microsite_id uuid references public.microsites (id) on delete cascade,
  viewing_request_id uuid references public.viewing_requests (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'organisations', 'profiles', 'organisation_memberships', 'developments', 'properties',
    'brochure_assets', 'leads', 'microsites', 'viewing_requests'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array[
    'organisation_memberships', 'developments', 'properties', 'brochure_assets', 'leads',
    'microsites', 'microsite_properties', 'engagement_events', 'viewing_requests', 'notifications'
  ] loop
    execute format('create trigger prevent_organisation_change before update on public.%I for each row execute function public.prevent_organisation_change()', t);
  end loop;
end;
$$;

create trigger check_lead_agent_membership
  before insert or update of assigned_agent_id on public.leads
  for each row execute function public.check_lead_agent_membership();

create or replace function public.on_lead_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.engagement_events (organisation_id, lead_id, event_type, actor, actor_user_id)
  values (new.organisation_id, new.id, 'lead_created', 'agent', new.created_by);
  return new;
end;
$$;

create trigger on_lead_created
  after insert on public.leads
  for each row execute function public.on_lead_created();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.developments enable row level security;
alter table public.properties enable row level security;
alter table public.brochure_assets enable row level security;
alter table public.leads enable row level security;
alter table public.microsites enable row level security;
alter table public.microsite_properties enable row level security;
alter table public.engagement_events enable row level security;
alter table public.viewing_requests enable row level security;
alter table public.notifications enable row level security;

-- Anonymous visitors get no direct table access at all.
revoke all on all tables in schema public from anon;

create policy "Members read their organisations" on public.organisations
  for select to authenticated using (public.is_org_member(id));
create policy "Admins update their organisation" on public.organisations
  for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));

create policy "Read own and teammates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name, phone_e164) on public.profiles to authenticated;

create policy "Members read memberships in their organisations" on public.organisation_memberships
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "Users update their own notification preferences" on public.organisation_memberships
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Admins add members" on public.organisation_memberships
  for insert to authenticated with check (public.has_org_role(organisation_id, array['owner', 'admin']));
create policy "Admins remove members" on public.organisation_memberships
  for delete to authenticated using (public.has_org_role(organisation_id, array['owner', 'admin']));
-- Users may only change notification preferences, never their role.
revoke update on public.organisation_memberships from authenticated;
grant update (notify_first_open, notify_viewing_request, notify_contact_request, notify_engagement)
  on public.organisation_memberships to authenticated;

do $$
declare t text;
begin
  foreach t in array array['developments', 'properties', 'brochure_assets', 'microsite_properties'] loop
    execute format('create policy "Members read" on public.%I for select to authenticated using (public.is_org_member(organisation_id))', t);
    execute format('create policy "Members insert" on public.%I for insert to authenticated with check (public.is_org_member(organisation_id))', t);
    execute format('create policy "Members update" on public.%I for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id))', t);
    execute format('create policy "Admins delete" on public.%I for delete to authenticated using (public.has_org_role(organisation_id, array[''owner'', ''admin'']))', t);
  end loop;
end;
$$;

create policy "Members read leads" on public.leads
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "Members create leads" on public.leads
  for insert to authenticated
  with check (public.is_org_member(organisation_id) and created_by = (select auth.uid()));
create policy "Members update leads" on public.leads
  for update to authenticated
  using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy "Admins delete leads" on public.leads
  for delete to authenticated using (public.has_org_role(organisation_id, array['owner', 'admin']));

create policy "Members read microsites" on public.microsites
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "Members create microsites" on public.microsites
  for insert to authenticated
  with check (public.is_org_member(organisation_id) and created_by = (select auth.uid()));
create policy "Members update microsites" on public.microsites
  for update to authenticated
  using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
-- The token hash is immutable once issued.
revoke update on public.microsites from authenticated;
grant update (expires_at, revoked_at, revoked_by, intro_message, show_buyer_name, whatsapp_initiated_at, message_sent_confirmed_at)
  on public.microsites to authenticated;

create policy "Members read engagement" on public.engagement_events
  for select to authenticated using (public.is_org_member(organisation_id));
-- Agents can only log their own agent actions; buyer events come from the public RPCs.
create policy "Agents log their own actions" on public.engagement_events
  for insert to authenticated
  with check (
    public.is_org_member(organisation_id)
    and actor = 'agent'
    and actor_user_id = (select auth.uid())
  );
revoke update, delete on public.engagement_events from authenticated;

create policy "Members read viewing requests" on public.viewing_requests
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "Members update viewing requests" on public.viewing_requests
  for update to authenticated
  using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
revoke insert, delete on public.viewing_requests from authenticated;
revoke update on public.viewing_requests from authenticated;
grant update (status, scheduled_for, agent_notes, handled_by) on public.viewing_requests to authenticated;

create policy "Recipients read their notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Recipients mark notifications read" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers used by the RPCs (not callable by clients)
-- ---------------------------------------------------------------------------

create or replace function public.lead_status_rank(s text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'new' then 0
    when 'microsite_generated' then 1
    when 'contacted' then 2
    when 'engaged' then 3
    when 'viewing_requested' then 4
    when 'viewing_scheduled' then 5
    when 'converted' then 6
    when 'lost' then 6
    else -1
  end;
$$;

-- Moves a lead forward automatically, never backwards and never out of a
-- terminal state. Agents can still set any status explicitly.
create or replace function public.advance_lead_status(p_lead_id uuid, p_target text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.leads
  set status = p_target
  where id = p_lead_id
    and status not in ('converted', 'lost')
    and public.lead_status_rank(status) < public.lead_status_rank(p_target);
$$;

create or replace function public.notify_lead_owner(
  p_lead_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_microsite_id uuid,
  p_viewing_request_id uuid,
  p_throttle interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_recipient uuid;
  v_enabled boolean;
begin
  select l.organisation_id, coalesce(l.assigned_agent_id, l.created_by)
    into v_org, v_recipient
  from public.leads l where l.id = p_lead_id;

  if v_recipient is null then
    return;
  end if;

  select case p_type
      when 'microsite_first_open' then m.notify_first_open
      when 'viewing_request' then m.notify_viewing_request
      when 'contact_request' then m.notify_contact_request
      when 'engagement' then m.notify_engagement
      else false
    end
    into v_enabled
  from public.organisation_memberships m
  where m.organisation_id = v_org and m.user_id = v_recipient;

  if not coalesce(v_enabled, false) then
    return;
  end if;

  if p_throttle is not null and exists (
    select 1 from public.notifications n
    where n.recipient_id = v_recipient
      and n.lead_id = p_lead_id
      and n.type = p_type
      and n.created_at > now() - p_throttle
  ) then
    return;
  end if;

  insert into public.notifications (organisation_id, recipient_id, type, title, body, lead_id, microsite_id, viewing_request_id)
  values (v_org, v_recipient, p_type, p_title, p_body, p_lead_id, p_microsite_id, p_viewing_request_id);
end;
$$;

create or replace function public.microsite_by_token(p_token text, out microsite_id uuid, out state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  state := 'not_found';
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    return;
  end if;

  select m.id, m.revoked_at, m.expires_at, l.archived_at as lead_archived_at
    into r
  from public.microsites m
  join public.leads l on l.id = m.lead_id
  where m.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    return;
  end if;

  microsite_id := r.id;
  if r.revoked_at is not null or r.lead_archived_at is not null then
    state := 'revoked';
  elsif r.expires_at is not null and r.expires_at <= now() then
    state := 'expired';
  else
    state := 'active';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public (buyer-facing) RPCs — callable with the anon key
-- ---------------------------------------------------------------------------

-- Returns only what the microsite needs to render. No internal IDs, no buyer
-- phone number, no budget, no agent notes.
create or replace function public.get_public_microsite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  v_result jsonb;
begin
  select * into v from public.microsite_by_token(p_token);
  if v.state <> 'active' then
    return jsonb_build_object('status', v.state);
  end if;

  select jsonb_build_object(
    'status', 'active',
    'organisationName', o.name,
    'buyerFirstName', case when m.show_buyer_name then nullif(split_part(btrim(l.buyer_name), ' ', 1), '') end,
    'configuration', l.configuration,
    'introMessage', m.intro_message,
    'expiresAt', m.expires_at,
    'agent', jsonb_build_object(
      'name', coalesce(p.full_name, d.contact_name),
      'phone', coalesce(p.phone_e164, d.contact_phone_e164)
    ),
    'development', jsonb_build_object(
      'name', d.name,
      'developerName', d.developer_name,
      'description', d.description,
      'location', d.location,
      'address', d.address,
      'mapUrl', d.map_url,
      'latitude', d.latitude,
      'longitude', d.longitude,
      'coverImagePath', d.cover_image_path,
      'galleryPaths', to_jsonb(d.gallery_paths),
      'amenities', to_jsonb(d.amenities),
      'paymentPlan', d.payment_plan,
      'paymentPlanNotes', d.payment_plan_notes,
      'contactName', d.contact_name,
      'contactPhone', d.contact_phone_e164,
      'contactEmail', d.contact_email
    ),
    'brochure', (
      select jsonb_build_object('title', b.title, 'path', b.storage_path, 'allowDownload', b.allow_download)
      from public.brochure_assets b
      where b.development_id = d.id and b.archived_at is null
      order by b.created_at desc
      limit 1
    ),
    'properties', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ref', mp.public_ref,
          'developmentName', pd.name,
          'unitReference', pr.unit_reference,
          'configuration', pr.configuration,
          'propertyType', pr.property_type,
          'bedrooms', pr.bedrooms,
          'bathrooms', pr.bathrooms,
          'area', pr.area,
          'areaUnit', pr.area_unit,
          'availabilityStatus', case when pr.archived_at is not null then 'unavailable' else pr.availability_status end,
          -- Prices are only shown for homes that are still available.
          'price', case when pr.archived_at is null and pr.availability_status = 'available' then pr.price end,
          'currency', pr.currency,
          'floor', pr.floor,
          'floorPlanPath', pr.floor_plan_path,
          'imagePaths', to_jsonb(pr.image_paths),
          'description', pr.description,
          'features', to_jsonb(pr.features),
          'paymentPlan', coalesce(pr.payment_plan, pd.payment_plan)
        )
        order by mp.position
      )
      from public.microsite_properties mp
      join public.properties pr on pr.id = mp.property_id
      join public.developments pd on pd.id = pr.development_id
      where mp.microsite_id = m.id and mp.removed_at is null
    ), '[]'::jsonb)
  )
  into v_result
  from public.microsites m
  join public.leads l on l.id = m.lead_id
  join public.developments d on d.id = l.development_id
  join public.organisations o on o.id = m.organisation_id
  left join public.profiles p on p.id = coalesce(l.assigned_agent_id, l.created_by)
  where m.id = v.microsite_id;

  return v_result;
end;
$$;

create or replace function public.record_microsite_event(
  p_token text,
  p_event_type text,
  p_session_id uuid,
  p_property_ref text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  m record;
  v_property_id uuid;
  v_page int;
  v_metadata jsonb := '{}'::jsonb;
  v_window interval;
begin
  if p_event_type not in (
    'microsite_opened', 'property_viewed', 'property_details_opened', 'floor_plan_opened',
    'brochure_opened', 'brochure_page_viewed', 'brochure_download_requested', 'brochure_closed',
    'payment_plan_opened', 'map_opened', 'whatsapp_clicked', 'viewing_request_started'
  ) then
    return jsonb_build_object('status', 'invalid_event');
  end if;
  if p_session_id is null then
    return jsonb_build_object('status', 'invalid_session');
  end if;

  select * into v from public.microsite_by_token(p_token);
  if v.state <> 'active' then
    return jsonb_build_object('status', v.state);
  end if;

  select ms.id, ms.organisation_id, ms.lead_id, ms.first_opened_at into m
  from public.microsites ms where ms.id = v.microsite_id;

  if p_event_type in ('property_viewed', 'property_details_opened', 'floor_plan_opened') and p_property_ref is null then
    return jsonb_build_object('status', 'invalid_property');
  end if;
  if p_property_ref is not null then
    select mp.property_id into v_property_id
    from public.microsite_properties mp
    where mp.microsite_id = m.id and mp.public_ref = p_property_ref and mp.removed_at is null;
    if v_property_id is null then
      return jsonb_build_object('status', 'invalid_property');
    end if;
  end if;

  -- Only keep the metadata keys we understand.
  if p_event_type = 'brochure_page_viewed' then
    begin
      v_page := (p_metadata ->> 'page')::int;
    exception when others then
      v_page := null;
    end;
    if v_page is null or v_page < 1 or v_page > 2000 then
      return jsonb_build_object('status', 'invalid_metadata');
    end if;
    v_metadata := jsonb_build_object('page', v_page);
  end if;

  -- Abuse controls: cap event volume per microsite and per session.
  if (select count(*) from public.engagement_events e
      where e.microsite_id = m.id and e.occurred_at > now() - interval '1 minute') >= 120
     or (select count(*) from public.engagement_events e
      where e.microsite_id = m.id and e.session_id = p_session_id
        and e.occurred_at > now() - interval '1 minute') >= 40 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- Deduplicate repeats (refreshes, re-renders) so analytics are not inflated.
  v_window := case
    when p_event_type in ('microsite_opened', 'property_viewed', 'brochure_page_viewed', 'brochure_opened') then interval '30 minutes'
    else interval '2 minutes'
  end;
  if exists (
    select 1 from public.engagement_events e
    where e.microsite_id = m.id
      and e.session_id = p_session_id
      and e.event_type = p_event_type
      and e.property_id is not distinct from v_property_id
      and e.metadata = v_metadata
      and e.occurred_at > now() - v_window
  ) then
    return jsonb_build_object('status', 'deduplicated');
  end if;

  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, property_id, session_id, metadata)
  values (m.organisation_id, m.lead_id, m.id, p_event_type, 'buyer', v_property_id, p_session_id, v_metadata);

  update public.microsites set last_activity_at = now() where id = m.id;
  update public.leads set last_engagement_at = now() where id = m.lead_id;

  if p_event_type = 'microsite_opened' and m.first_opened_at is null then
    update public.microsites set first_opened_at = now() where id = m.id;
    perform public.advance_lead_status(m.lead_id, 'engaged');
    perform public.notify_lead_owner(
      m.lead_id, 'microsite_first_open', 'Microsite opened for the first time',
      'The buyer opened their personalised property selection.', m.id, null, null
    );
  elsif p_event_type = 'microsite_opened' then
    perform public.advance_lead_status(m.lead_id, 'engaged');
  elsif p_event_type = 'whatsapp_clicked' then
    perform public.notify_lead_owner(
      m.lead_id, 'contact_request', 'Buyer tapped the WhatsApp contact button',
      'WhatsApp was opened from the microsite. A message may or may not follow.', m.id, null, interval '6 hours'
    );
  elsif p_event_type in ('floor_plan_opened', 'brochure_opened', 'payment_plan_opened') then
    perform public.notify_lead_owner(
      m.lead_id, 'engagement', 'Recent microsite activity',
      'The buyer is exploring their property selection.', m.id, null, interval '1 hour'
    );
  end if;

  return jsonb_build_object('status', 'recorded');
end;
$$;

create or replace function public.submit_viewing_request(
  p_token text,
  p_session_id uuid,
  p_name text,
  p_phone_e164 text,
  p_preferred_date date,
  p_time_range text,
  p_property_ref text default null,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  m record;
  v_property_id uuid;
  v_today date;
  v_request_id uuid;
begin
  select * into v from public.microsite_by_token(p_token);
  if v.state <> 'active' then
    return jsonb_build_object('status', v.state);
  end if;

  select ms.id, ms.organisation_id, ms.lead_id, o.timezone into m
  from public.microsites ms
  join public.organisations o on o.id = ms.organisation_id
  where ms.id = v.microsite_id;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    return jsonb_build_object('status', 'invalid', 'field', 'name');
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{6,14}$' then
    return jsonb_build_object('status', 'invalid', 'field', 'phone');
  end if;
  if p_time_range is null or p_time_range not in ('morning', 'afternoon', 'evening') then
    return jsonb_build_object('status', 'invalid', 'field', 'timeRange');
  end if;
  v_today := (now() at time zone m.timezone)::date;
  if p_preferred_date is null or p_preferred_date < v_today or p_preferred_date > v_today + 365 then
    return jsonb_build_object('status', 'invalid', 'field', 'preferredDate');
  end if;
  if p_message is not null and char_length(p_message) > 1000 then
    return jsonb_build_object('status', 'invalid', 'field', 'message');
  end if;

  if p_property_ref is not null then
    select mp.property_id into v_property_id
    from public.microsite_properties mp
    join public.properties pr on pr.id = mp.property_id
    where mp.microsite_id = m.id and mp.public_ref = p_property_ref and mp.removed_at is null
      and pr.archived_at is null and pr.availability_status = 'available';
    if v_property_id is null then
      return jsonb_build_object('status', 'invalid', 'field', 'property');
    end if;
  end if;

  -- Identical resubmission (double tap, retry): treat as already received.
  if exists (
    select 1 from public.viewing_requests r
    where r.microsite_id = m.id
      and r.preferred_date = p_preferred_date
      and r.preferred_time_range = p_time_range
      and r.property_id is not distinct from v_property_id
      and r.created_at > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('status', 'submitted', 'duplicate', true);
  end if;

  if (select count(*) from public.viewing_requests r
      where r.microsite_id = m.id and r.created_at > now() - interval '24 hours') >= 5 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.viewing_requests (
    organisation_id, microsite_id, lead_id, property_id, name, phone_e164, preferred_date, preferred_time_range, message
  ) values (
    m.organisation_id, m.id, m.lead_id, v_property_id, btrim(p_name), p_phone_e164, p_preferred_date, p_time_range,
    nullif(btrim(coalesce(p_message, '')), '')
  )
  returning id into v_request_id;

  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, property_id, session_id, metadata)
  values (
    m.organisation_id, m.lead_id, m.id, 'viewing_request_submitted', 'buyer', v_property_id, p_session_id,
    jsonb_build_object('preferredDate', p_preferred_date, 'timeRange', p_time_range)
  );

  update public.microsites set last_activity_at = now() where id = m.id;
  update public.leads set last_engagement_at = now() where id = m.lead_id;
  perform public.advance_lead_status(m.lead_id, 'viewing_requested');
  perform public.notify_lead_owner(
    m.lead_id, 'viewing_request', 'New viewing request',
    format('Requested for %s (%s). Not yet confirmed.', to_char(p_preferred_date, 'DD Mon YYYY'), p_time_range),
    m.id, v_request_id, null
  );

  return jsonb_build_object('status', 'submitted');
end;
$$;

-- ---------------------------------------------------------------------------
-- Agent RPCs — SECURITY INVOKER, so RLS applies to every statement inside
-- them. They exist to make multi-step changes atomic.
-- ---------------------------------------------------------------------------

create or replace function public.create_microsite(
  p_lead_id uuid,
  p_token_hash text,
  p_token_ciphertext text,
  p_property_ids uuid[],
  p_match_tiers jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null,
  p_intro_message text default null,
  p_show_buyer_name boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lead record;
  v_count int := coalesce(array_length(p_property_ids, 1), 0);
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select l.id, l.organisation_id, l.archived_at into v_lead
  from public.leads l where l.id = p_lead_id;
  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if v_lead.archived_at is not null then
    raise exception 'lead_archived' using errcode = '22023';
  end if;
  if v_count = 0 then
    raise exception 'no_properties_selected' using errcode = '22023';
  end if;
  if v_count > 12 then
    raise exception 'too_many_properties' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_property_ids) x) <> v_count
     or (select count(*) from public.properties pr
         where pr.id = any (p_property_ids)
           and pr.organisation_id = v_lead.organisation_id
           and pr.archived_at is null
           and pr.availability_status = 'available') <> v_count then
    raise exception 'invalid_property_selection' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;

  update public.microsites
  set revoked_at = now(), revoked_by = v_uid
  where lead_id = p_lead_id and revoked_at is null;

  insert into public.microsites (
    organisation_id, lead_id, token_hash, token_ciphertext, expires_at, intro_message, show_buyer_name, created_by
  ) values (
    v_lead.organisation_id, p_lead_id, p_token_hash, p_token_ciphertext, p_expires_at,
    nullif(btrim(coalesce(p_intro_message, '')), ''), coalesce(p_show_buyer_name, true), v_uid
  )
  returning id into v_id;

  insert into public.microsite_properties (organisation_id, microsite_id, property_id, position, match_tier, snapshot)
  select
    v_lead.organisation_id, v_id, pr.id, ord.n,
    coalesce(nullif(p_match_tiers ->> pr.id::text, ''), 'manual'),
    jsonb_build_object(
      'unitReference', pr.unit_reference, 'configuration', pr.configuration, 'price', pr.price,
      'currency', pr.currency, 'availabilityStatus', pr.availability_status,
      'area', pr.area, 'areaUnit', pr.area_unit
    )
  from unnest(p_property_ids) with ordinality as ord (property_id, n)
  join public.properties pr on pr.id = ord.property_id;

  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, actor_user_id, metadata)
  values (v_lead.organisation_id, p_lead_id, v_id, 'microsite_generated', 'agent', v_uid,
          jsonb_build_object('propertyCount', v_count));

  update public.leads set status = 'microsite_generated' where id = p_lead_id and status = 'new';

  return v_id;
end;
$$;

create or replace function public.update_microsite_selection(
  p_microsite_id uuid,
  p_property_ids uuid[],
  p_match_tiers jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ms record;
  v_count int := coalesce(array_length(p_property_ids, 1), 0);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select ms.id, ms.organisation_id, ms.lead_id, ms.revoked_at into v_ms
  from public.microsites ms where ms.id = p_microsite_id;
  if not found then
    raise exception 'microsite_not_found' using errcode = 'P0002';
  end if;
  if v_ms.revoked_at is not null then
    raise exception 'microsite_revoked' using errcode = '22023';
  end if;
  if v_count = 0 then
    raise exception 'no_properties_selected' using errcode = '22023';
  end if;
  if v_count > 12 then
    raise exception 'too_many_properties' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_property_ids) x) <> v_count
     or (select count(*) from public.properties pr
         where pr.id = any (p_property_ids)
           and pr.organisation_id = v_ms.organisation_id
           and pr.archived_at is null
           and pr.availability_status = 'available') <> v_count then
    raise exception 'invalid_property_selection' using errcode = '22023';
  end if;

  -- Keep removed rows for history rather than deleting them.
  update public.microsite_properties
  set removed_at = now()
  where microsite_id = p_microsite_id and removed_at is null and not (property_id = any (p_property_ids));

  insert into public.microsite_properties (organisation_id, microsite_id, property_id, position, match_tier, snapshot)
  select
    v_ms.organisation_id, p_microsite_id, pr.id, ord.n,
    coalesce(nullif(p_match_tiers ->> pr.id::text, ''), 'manual'),
    jsonb_build_object(
      'unitReference', pr.unit_reference, 'configuration', pr.configuration, 'price', pr.price,
      'currency', pr.currency, 'availabilityStatus', pr.availability_status,
      'area', pr.area, 'areaUnit', pr.area_unit
    )
  from unnest(p_property_ids) with ordinality as ord (property_id, n)
  join public.properties pr on pr.id = ord.property_id
  where not exists (
    select 1 from public.microsite_properties mp
    where mp.microsite_id = p_microsite_id and mp.property_id = pr.id and mp.removed_at is null
  );

  update public.microsite_properties mp
  set position = ord.n
  from unnest(p_property_ids) with ordinality as ord (property_id, n)
  where mp.microsite_id = p_microsite_id and mp.removed_at is null and mp.property_id = ord.property_id;

  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, actor_user_id, metadata)
  values (v_ms.organisation_id, v_ms.lead_id, p_microsite_id, 'microsite_selection_updated', 'agent', v_uid,
          jsonb_build_object('propertyCount', v_count));
end;
$$;

create or replace function public.revoke_microsite(p_microsite_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ms record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select ms.id, ms.organisation_id, ms.lead_id, ms.revoked_at into v_ms
  from public.microsites ms where ms.id = p_microsite_id;
  if not found then
    raise exception 'microsite_not_found' using errcode = 'P0002';
  end if;
  if v_ms.revoked_at is not null then
    return;
  end if;
  update public.microsites set revoked_at = now(), revoked_by = v_uid where id = p_microsite_id;
  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, actor_user_id)
  values (v_ms.organisation_id, v_ms.lead_id, p_microsite_id, 'microsite_revoked', 'agent', v_uid);
end;
$$;

create or replace function public.record_whatsapp_initiated(p_microsite_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ms record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select ms.id, ms.organisation_id, ms.lead_id into v_ms
  from public.microsites ms where ms.id = p_microsite_id and ms.revoked_at is null;
  if not found then
    raise exception 'microsite_not_found' using errcode = 'P0002';
  end if;
  update public.microsites set whatsapp_initiated_at = now() where id = p_microsite_id;
  -- Logged as "initiated" only: wa.me cannot tell us whether the message was sent.
  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, actor_user_id)
  values (v_ms.organisation_id, v_ms.lead_id, p_microsite_id, 'whatsapp_initiated', 'agent', v_uid);
end;
$$;

create or replace function public.mark_lead_contacted(p_lead_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lead record;
  v_microsite_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select l.id, l.organisation_id, l.status into v_lead from public.leads l where l.id = p_lead_id;
  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;

  update public.leads
  set contacted_at = coalesce(contacted_at, now()),
      status = case
        when status in ('converted', 'lost') then status
        when public.lead_status_rank(status) < public.lead_status_rank('contacted') then 'contacted'
        else status
      end
  where id = p_lead_id;

  select ms.id into v_microsite_id from public.microsites ms
  where ms.lead_id = p_lead_id and ms.revoked_at is null;
  if v_microsite_id is not null then
    update public.microsites set message_sent_confirmed_at = now() where id = v_microsite_id;
  end if;

  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, actor_user_id)
  values (v_lead.organisation_id, p_lead_id, v_microsite_id, 'marked_contacted', 'agent', v_uid);
end;
$$;

create or replace function public.set_lead_status(p_lead_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lead record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if public.lead_status_rank(p_status) < 0 then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select l.id, l.organisation_id, l.status into v_lead from public.leads l where l.id = p_lead_id;
  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if v_lead.status = p_status then
    return;
  end if;
  update public.leads
  set status = p_status,
      contacted_at = case when p_status = 'contacted' then coalesce(contacted_at, now()) else contacted_at end
  where id = p_lead_id;
  insert into public.engagement_events (organisation_id, lead_id, event_type, actor, actor_user_id, metadata)
  values (v_lead.organisation_id, p_lead_id, 'lead_status_changed', 'agent', v_uid,
          jsonb_build_object('from', v_lead.status, 'to', p_status));
end;
$$;

create or replace function public.update_viewing_request(
  p_request_id uuid,
  p_status text,
  p_scheduled_for timestamptz default null,
  p_agent_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_status not in ('requested', 'contacted', 'confirmed', 'rescheduled', 'completed', 'cancelled') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status in ('confirmed', 'rescheduled') and p_scheduled_for is null then
    raise exception 'scheduled_time_required' using errcode = '22023';
  end if;

  select r.id, r.organisation_id, r.lead_id, r.microsite_id, r.status, r.scheduled_for into v_req
  from public.viewing_requests r where r.id = p_request_id;
  if not found then
    raise exception 'viewing_request_not_found' using errcode = 'P0002';
  end if;

  update public.viewing_requests
  set status = p_status,
      scheduled_for = case when p_status in ('confirmed', 'rescheduled') then p_scheduled_for else scheduled_for end,
      agent_notes = coalesce(nullif(btrim(coalesce(p_agent_notes, '')), ''), agent_notes),
      handled_by = v_uid
  where id = p_request_id;

  if p_status in ('confirmed', 'rescheduled') then
    update public.leads
    set status = 'viewing_scheduled'
    where id = v_req.lead_id
      and status not in ('converted', 'lost')
      and public.lead_status_rank(status) < public.lead_status_rank('viewing_scheduled');
  end if;

  insert into public.engagement_events (organisation_id, lead_id, microsite_id, event_type, actor, actor_user_id, metadata)
  values (v_req.organisation_id, v_req.lead_id, v_req.microsite_id, 'viewing_status_changed', 'agent', v_uid,
          jsonb_build_object('from', v_req.status, 'to', p_status, 'scheduledFor', p_scheduled_for));
end;
$$;

-- Aggregated analytics for one organisation over a date range. SECURITY
-- INVOKER: RLS still decides which rows are visible.
create or replace function public.analytics_summary(p_org uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tz text;
  v_result jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select timezone into v_tz from public.organisations where id = p_org;

  with ev as (
    select e.* from public.engagement_events e
    where e.organisation_id = p_org and e.actor = 'buyer'
      and e.occurred_at >= p_from and e.occurred_at < p_to
  ),
  leads_in_range as (
    select l.* from public.leads l
    where l.organisation_id = p_org and l.archived_at is null
      and l.created_at >= p_from and l.created_at < p_to
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'rawEvents', (select count(*) from ev),
      'visits', (select count(distinct (microsite_id, session_id)) from ev where event_type = 'microsite_opened'),
      'micrositesOpened', (select count(distinct microsite_id) from ev where event_type = 'microsite_opened'),
      'propertyDetails', (select count(*) from ev where event_type = 'property_details_opened'),
      'floorPlans', (select count(*) from ev where event_type = 'floor_plan_opened'),
      'brochureOpens', (select count(*) from ev where event_type = 'brochure_opened'),
      'brochurePages', (select count(*) from ev where event_type = 'brochure_page_viewed'),
      'paymentPlanViews', (select count(*) from ev where event_type = 'payment_plan_opened'),
      'whatsappClicks', (select count(*) from ev where event_type = 'whatsapp_clicked'),
      'viewingRequests', (select count(*) from public.viewing_requests r
                          where r.organisation_id = p_org and r.created_at >= p_from and r.created_at < p_to)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', d, 'visits', visits, 'events', events) order by d)
      from (
        select (occurred_at at time zone v_tz)::date as d,
               count(distinct (microsite_id, session_id)) filter (where event_type = 'microsite_opened') as visits,
               count(*) as events
        from ev group by 1
      ) s
    ), '[]'::jsonb),
    'byDevelopment', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'visits', visits, 'events', events, 'viewingRequests', requests) order by events desc)
      from (
        select d.name,
               count(distinct (ev.microsite_id, ev.session_id)) filter (where ev.event_type = 'microsite_opened') as visits,
               count(ev.id) as events,
               count(ev.id) filter (where ev.event_type = 'viewing_request_submitted') as requests
        from ev
        join public.leads l on l.id = ev.lead_id
        join public.developments d on d.id = l.development_id
        group by d.name
      ) s
    ), '[]'::jsonb),
    'byMicrosite', coalesce((
      select jsonb_agg(row_to_json(s)::jsonb order by s.events desc)
      from (
        select ev.microsite_id as "micrositeId", l.id as "leadId", l.buyer_name as "buyerName", d.name as "developmentName",
               count(distinct ev.session_id) filter (where ev.event_type = 'microsite_opened') as visits,
               count(*) as events,
               max(ev.occurred_at) as "lastActivityAt"
        from ev
        join public.leads l on l.id = ev.lead_id
        join public.developments d on d.id = l.development_id
        where ev.microsite_id is not null
        group by ev.microsite_id, l.id, l.buyer_name, d.name
        order by count(*) desc
        limit 10
      ) s
    ), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'enquiries', (select count(*) from leads_in_range),
      'withMicrosite', (select count(*) from leads_in_range l where exists (select 1 from public.microsites m where m.lead_id = l.id)),
      'opened', (select count(*) from leads_in_range l where exists (select 1 from public.microsites m where m.lead_id = l.id and m.first_opened_at is not null)),
      'viewingRequested', (select count(*) from leads_in_range l where exists (select 1 from public.viewing_requests r where r.lead_id = l.id)),
      'viewingScheduled', (select count(*) from leads_in_range l where exists (
        select 1 from public.viewing_requests r where r.lead_id = l.id and r.status in ('confirmed', 'rescheduled', 'completed'))),
      'converted', (select count(*) from leads_in_range l where l.status = 'converted')
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;
grant execute on function public.is_media_prefix_member(text) to authenticated;
grant execute on function public.lead_status_rank(text) to authenticated;

grant execute on function public.get_public_microsite(text) to anon, authenticated;
grant execute on function public.record_microsite_event(text, text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.submit_viewing_request(text, uuid, text, text, date, text, text, text) to anon, authenticated;

grant execute on function public.create_microsite(uuid, text, text, uuid[], jsonb, timestamptz, text, boolean) to authenticated;
grant execute on function public.update_microsite_selection(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.revoke_microsite(uuid) to authenticated;
grant execute on function public.record_whatsapp_initiated(uuid) to authenticated;
grant execute on function public.mark_lead_contacted(uuid) to authenticated;
grant execute on function public.set_lead_status(uuid, text) to authenticated;
grant execute on function public.update_viewing_request(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.analytics_summary(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one public-read bucket for marketing media. Uploads, updates and
-- deletes are limited to members of the organisation that owns the folder.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-media', 'property-media', true, 26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Members upload organisation media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-media' and public.is_media_prefix_member((storage.foldername(name))[1]));
create policy "Members update organisation media" on storage.objects
  for update to authenticated
  using (bucket_id = 'property-media' and public.is_media_prefix_member((storage.foldername(name))[1]));
create policy "Members delete organisation media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-media' and public.is_media_prefix_member((storage.foldername(name))[1]));
create policy "Members list organisation media" on storage.objects
  for select to authenticated
  using (bucket_id = 'property-media' and public.is_media_prefix_member((storage.foldername(name))[1]));
