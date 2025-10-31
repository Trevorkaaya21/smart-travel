create table if not exists trip_collaborators (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  email text not null,
  invited_by text not null,
  status text not null default 'accepted',
  created_at timestamptz not null default now(),
  unique (trip_id, email)
);

create index if not exists idx_trip_collaborators_trip on trip_collaborators (trip_id);
create index if not exists idx_trip_collaborators_email on trip_collaborators (email);

create table if not exists trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  author_email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_messages_trip_created on trip_messages (trip_id, created_at);
