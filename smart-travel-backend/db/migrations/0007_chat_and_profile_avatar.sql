-- 0007: Profile avatar + travel name, Travel Chat (1:1 conversations + messages).
-- Run with: supabase db push (or apply via your migration runner).
-- Profile: avatar and travel name (for chat discovery)
alter table profiles
  add column if not exists avatar_url text,
  add column if not exists travel_name text;

create unique index if not exists profiles_travel_name_key
  on profiles (lower(trim(travel_name))) where trim(travel_name) <> '';

-- 1:1 chat: conversations between two users (normalized so user_a < user_b)
create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_email text not null,
  user_b_email text not null,
  created_at timestamptz not null default now(),
  constraint chat_conversations_order check (user_a_email < user_b_email),
  unique (user_a_email, user_b_email)
);

create index if not exists idx_chat_conversations_user_a on chat_conversations (user_a_email);
create index if not exists idx_chat_conversations_user_b on chat_conversations (user_b_email);

-- Messages in a conversation
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation_created on chat_messages (conversation_id, created_at);
