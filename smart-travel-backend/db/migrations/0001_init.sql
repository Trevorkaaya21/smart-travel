
create extension if not exists vector;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  auth_provider_id text unique,
  created_at timestamptz not null default now()
);
create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  name text,
  home_airport text,
  budget_tier text check (budget_tier in ('$', '$$', '$$$', '$$$$')),
  interests text[],
  dietary text[],
  accessibility text[],
  timezone text,
  updated_at timestamptz not null default now()
);
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  destinations text[] not null,
  start_date date not null,
  end_date date not null,
  party_size int default 1,
  budget_tier text,
  created_at timestamptz not null default now()
);
create table if not exists itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  date date not null,
  notes text
);
create table if not exists stops (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references itinerary_days(id) on delete cascade,
  place_id text not null,
  start_ts timestamptz,
  end_ts timestamptz,
  travel_minutes int,
  cost_estimate numeric
);
create table if not exists places (
  id text primary key,
  name text not null,
  category text,
  lat double precision,
  lon double precision,
  price_tier text,
  rating numeric,
  hours_json jsonb,
  source text,
  raw_json jsonb
);
create table if not exists place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id text references places(id) on delete cascade,
  summary text,
  pros text[],
  cons text[],
  last_sync timestamptz
);
create table if not exists favorites (
  user_id uuid references users(id) on delete cascade,
  place_id text references places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  day_id uuid references itinerary_days(id) on delete set null,
  text text,
  photos text[],
  tags text[],
  created_at timestamptz not null default now()
);
create table if not exists embeddings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  vector vector(1536) not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
-- Indexes
create index if not exists idx_places_category_rating on places (category, rating desc);
create index if not exists idx_trip_user on trips (user_id, start_date);
create index if not exists idx_embeddings_entity on embeddings (entity_type, entity_id);
create index if not exists idx_embeddings_vector on embeddings using ivfflat (vector);
