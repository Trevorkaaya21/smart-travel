-- ML Feature Support Migration
-- Adds tables and indexes to support machine learning features

-- Place embeddings cache (precomputed for fast search)
create table if not exists place_embeddings (
  place_id text primary key references places(id) on delete cascade,
  embedding_vector bytea not null,
  model_version text not null default 'all-MiniLM-L6-v2',
  updated_at timestamptz default now()
);

comment on table place_embeddings is 'Cached sentence-transformer embeddings for semantic search';

-- User preference profiles (learned from behavior)
create table if not exists user_ml_profiles (
  user_email text primary key,
  preferred_categories text[] default '{}',
  avg_rating_preference numeric(3,2) default 4.0,
  location_preferences jsonb default '{}',
  interaction_count integer default 0,
  last_updated timestamptz default now()
);

create index if not exists idx_user_ml_profiles_updated on user_ml_profiles (last_updated desc);

comment on table user_ml_profiles is 'ML-derived user preference profiles for personalized recommendations';

-- ML model metadata (tracking model versions and performance)
create table if not exists ml_models (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  model_version text not null,
  model_type text not null check (model_type in ('embedding', 'recommendation', 'classification')),
  metrics jsonb default '{}',
  places_indexed integer default 0,
  created_at timestamptz default now(),
  is_active boolean default true
);

create index if not exists idx_ml_models_active on ml_models (model_type, is_active);

comment on table ml_models is 'Track ML model versions, metrics, and deployment status';

-- Performance index for ML queries
create index if not exists idx_places_category_rating on places (category, rating desc nulls last);
create index if not exists idx_places_location on places (lat, lng) where lat is not null and lng is not null;
create index if not exists idx_favorites_created on favorites (created_at desc);
create index if not exists idx_trip_items_created on trip_items (created_at desc);
