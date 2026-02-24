-- Add price tracking tables

-- Price alerts table
create table if not exists price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  place_id text not null,
  place_name text not null,
  target_price numeric(10, 2) not null,
  current_price numeric(10, 2) default 0,
  alert_type text not null check (alert_type in ('below', 'above', 'change')),
  is_active boolean default true,
  created_at timestamptz default now(),
  last_checked timestamptz default now(),
  last_triggered timestamptz
);

create index if not exists idx_price_alerts_user on price_alerts (user_email, is_active);
create index if not exists idx_price_alerts_place on price_alerts (place_id, is_active);

comment on table price_alerts is 'User-configured price alerts for places';
comment on column price_alerts.alert_type is 'Alert when price goes below, above, or changes by percentage';

-- Price history table
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  price numeric(10, 2) not null,
  currency text default 'USD',
  date date not null default current_date,
  source text not null,
  created_at timestamptz default now()
);

create index if not exists idx_price_history_place_date on price_history (place_id, date desc);
create unique index if not exists idx_price_history_unique on price_history (place_id, date, source);

comment on table price_history is 'Historical price data for places over time';

-- Reviews and ratings table
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  user_email text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  review_text text,
  photos text[], -- Array of photo URLs
  visit_date date,
  is_verified boolean default false, -- Verified if user actually booked/visited
  helpful_count integer default 0,
  not_helpful_count integer default 0,
  response_text text, -- Business owner response
  response_date timestamptz,
  is_hidden boolean default false, -- Moderation flag
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reviews_place on reviews (place_id, created_at desc);
create index if not exists idx_reviews_user on reviews (user_email);
create index if not exists idx_reviews_rating on reviews (place_id, rating);
create unique index if not exists idx_reviews_unique on reviews (place_id, user_email);

comment on table reviews is 'User reviews and ratings for places';
comment on column reviews.is_verified is 'True if review is from verified booking/visit';

-- Review helpfulness votes
create table if not exists review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  user_email text not null,
  is_helpful boolean not null,
  created_at timestamptz default now(),
  unique(review_id, user_email)
);

create index if not exists idx_review_votes_review on review_votes (review_id);

comment on table review_votes is 'User votes on review helpfulness';

-- Analytics events table
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_email text,
  session_id text,
  properties jsonb,
  user_agent text,
  ip_address inet,
  created_at timestamptz default now()
);

create index if not exists idx_analytics_events_name on analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_user on analytics_events (user_email, created_at desc);
create index if not exists idx_analytics_events_session on analytics_events (session_id);

comment on table analytics_events is 'User behavior and interaction tracking';

-- Booking integrations table
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  trip_id uuid references trips(id) on delete set null,
  place_id text not null,
  booking_type text not null check (booking_type in ('hotel', 'flight', 'activity', 'restaurant')),
  provider text not null, -- 'booking.com', 'expedia', etc.
  external_id text, -- ID from provider
  status text not null check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  check_in_date date,
  check_out_date date,
  guest_count integer,
  total_price numeric(10, 2),
  currency text default 'USD',
  confirmation_code text,
  booking_details jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bookings_user on bookings (user_email, created_at desc);
create index if not exists idx_bookings_trip on bookings (trip_id);
create index if not exists idx_bookings_status on bookings (status, created_at desc);

comment on table bookings is 'User bookings from integrated providers';

-- Update timestamp trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_reviews_updated_at before update on reviews
  for each row execute function update_updated_at_column();

create trigger update_bookings_updated_at before update on bookings
  for each row execute function update_updated_at_column();
