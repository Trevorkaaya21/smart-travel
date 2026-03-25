-- Link diaries to trips so users can navigate between them
alter table diaries add column if not exists trip_id uuid references trips(id) on delete set null;
create index if not exists idx_diaries_trip_id on diaries(trip_id);
create index if not exists idx_diaries_owner_email on diaries(owner_email);
