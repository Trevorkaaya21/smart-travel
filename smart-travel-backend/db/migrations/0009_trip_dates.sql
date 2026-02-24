-- Add optional start_date and end_date to trips for real-time upcoming vs past grouping
alter table trips
  add column if not exists start_date date,
  add column if not exists end_date date;

comment on column trips.start_date is 'First day of the trip (optional)';
comment on column trips.end_date is 'Last day of the trip; used to determine upcoming vs past';

create index if not exists idx_trips_end_date on trips (owner_email, end_date desc nulls last);
