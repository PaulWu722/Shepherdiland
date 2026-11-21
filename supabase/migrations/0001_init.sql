create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  school text not null check (school in ('亞洲大學', '朝陽科技大學')),
  department text not null,
  grade text not null default '',
  openness integer not null default 2 check (openness between 1 and 5),
  line_id text not null default '',
  line_type text not null default 'personal' check (line_type in ('personal','official')),
  instagram text not null default '',
  introduction text not null default '',
  notes text not null default '',
  hair text not null default 'short' check (hair in ('short','long')),
  shirt text not null default '#72b6a1' check (shirt ~ '^#[0-9a-fA-F]{6}$'),
  last_contact date,
  frequency_mode text not null default 'interval' check (frequency_mode in ('interval','weekly')),
  frequency_value integer not null default 2 check (frequency_value between 1 and 365),
  bible_progress jsonb,
  life_updates text not null default '',
  unique (id, user_id)
);
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null,
  date date not null,
  method text not null check (method in ('見面','LINE','IG','電話')),
  summary text not null check (length(trim(summary)) > 0),
  topics text[] not null default '{}',
  ai jsonb,
  created_at timestamptz not null default now(),
  foreign key (contact_id,user_id) references public.contacts(id,user_id) on delete cascade,
  unique (id,contact_id,user_id)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null,
  date date not null,
  time time not null,
  location text not null default '',
  scripture text not null default '',
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  foreign key (contact_id,user_id) references public.contacts(id,user_id) on delete cascade
);
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null,
  content text not null check (length(trim(content)) > 0),
  date date not null,
  answered boolean not null default false,
  foreign key (contact_id,user_id) references public.contacts(id,user_id) on delete cascade
);
create table public.screenshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null,
  interaction_id uuid not null,
  storage_path text not null unique,
  uploaded_at timestamptz not null default now(),
  position integer not null check (position >= 0),
  check (storage_path like user_id::text || '/' || contact_id::text || '/%.webp'),
  foreign key (interaction_id,contact_id,user_id) references public.interactions(id,contact_id,user_id) on delete cascade
);
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null unique,
  interaction_id uuid,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  feedback integer not null default 0 check (feedback between -1 and 1),
  foreign key (contact_id,user_id) references public.contacts(id,user_id) on delete cascade,
  foreign key (interaction_id,contact_id,user_id) references public.interactions(id,contact_id,user_id) on delete cascade
);
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  preferences jsonb not null default '{}'
);

do $$
declare tab text;
begin
  foreach tab in array array['contacts','interactions','appointments','prayer_requests','screenshots','suggestions','settings']
  loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', tab);
    execute format('revoke all on public.%I from anon', tab);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tab);
    execute format('create index on public.%I (user_id)', tab);
  end loop;
end $$;
create index on public.interactions (contact_id, user_id, date);
create index on public.appointments (contact_id, user_id, date);
create index on public.prayer_requests (contact_id, user_id);
create index on public.screenshots (interaction_id, contact_id, user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('chat-screenshots','chat-screenshots',false,6291456,array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy own_chat_screenshots on storage.objects for all to authenticated
using (bucket_id = 'chat-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (
  bucket_id = 'chat-screenshots'
  and array_length(storage.foldername(name), 1) = 2
  and storage.extension(name) = 'webp'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.contacts c where c.user_id = (select auth.uid()) and c.id::text = (storage.foldername(name))[2])
);

create function public.record_interaction(payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid();
  member uuid := (payload->'interaction'->>'contact_id')::uuid;
  contact_data public.contacts := jsonb_populate_record(null::public.contacts, payload->'contact');
  interaction_data public.interactions := jsonb_populate_record(null::public.interactions, payload->'interaction');
begin
  if owner is null or member is null or contact_data.id is distinct from member then
    raise exception '無法儲存這位成員的紀錄';
  end if;
  update public.contacts
    set last_contact = greatest(last_contact, interaction_data.date),
        bible_progress = case when interaction_data.ai is null then bible_progress else coalesce(contact_data.bible_progress,bible_progress) end,
        life_updates = case when interaction_data.ai is null then life_updates else contact_data.life_updates end,
        openness = case when interaction_data.ai is null then openness else contact_data.openness end
    where id = member and user_id = owner;
  if not found then raise exception '找不到成員'; end if;
  insert into public.interactions (id,user_id,contact_id,date,method,summary,topics,ai,created_at)
    values (interaction_data.id,owner,member,interaction_data.date,interaction_data.method,
      interaction_data.summary,interaction_data.topics,interaction_data.ai,interaction_data.created_at);
  if jsonb_typeof(payload->'appointment') = 'object' then
    insert into public.appointments (id,user_id,contact_id,date,time,location,scripture,status)
      select a.id,owner,member,a.date,a.time,a.location,a.scripture,a.status
      from jsonb_populate_record(null::public.appointments, payload->'appointment') a;
  end if;
  insert into public.prayer_requests (id,user_id,contact_id,content,date,answered)
    select p.id,owner,member,p.content,p.date,p.answered
    from jsonb_populate_recordset(null::public.prayer_requests, payload->'prayers') p;
  insert into public.screenshots (id,user_id,contact_id,interaction_id,storage_path,uploaded_at,position)
    select s.id,owner,member,interaction_data.id,s.storage_path,s.uploaded_at,s.position
    from jsonb_populate_recordset(null::public.screenshots, payload->'screenshots') s;
end;
$$;
revoke execute on function public.record_interaction(jsonb) from public, anon;
grant execute on function public.record_interaction(jsonb) to authenticated;
