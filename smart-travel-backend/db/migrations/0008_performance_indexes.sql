-- 0008: Performance indexes for scalability (trips, favorites, diary)
-- Run with: supabase db push
create index if not exists idx_trips_owner_created on trips (owner_email, created_at desc);
create index if not exists idx_favorites_user_created on favorites (user_email, created_at desc);
create index if not exists idx_diaries_owner_created on diaries (owner_email, created_at desc);
