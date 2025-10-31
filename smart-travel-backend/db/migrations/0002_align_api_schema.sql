do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'diary_entries') then
    execute 'drop table diary_entries';
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'diaries') then
    execute 'drop table diaries';
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'trip_items') then
    execute 'drop table trip_items';
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'favorites') then
    execute 'drop table favorites';
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'places') then
    execute 'drop table places';
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'trips') then
    execute 'drop table trips';
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'profiles') then
    execute 'drop table profiles';
  end if;
end $$;

create table places (
  id text primary key,
  name text not null,
  category text,
  rating numeric,
  lat double precision,
  lng double precision,
  photo text,
  photo_credit text
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  created_at timestamptz not null default now(),
  is_public boolean not null default false,
  share_id text unique
);
create index trips_owner_email_idx on trips(owner_email);

create table trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id text not null,
  day int not null default 1,
  note text,
  created_at timestamptz not null default now()
);
create index trip_items_trip_idx on trip_items(trip_id);

create table favorites (
  user_email text not null,
  place_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_email, place_id)
);
create index favorites_user_email_idx on favorites(user_email);

create table profiles (
  email text primary key,
  display_name text,
  home_base text,
  bio text,
  updated_at timestamptz not null default now()
);

create table diaries (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  title text,
  created_at timestamptz not null default now()
);

create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references diaries(id) on delete cascade,
  day int,
  text text,
  created_at timestamptz not null default now()
);
