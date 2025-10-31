alter table diary_entries
  add column if not exists photo_data text,
  add column if not exists photo_caption text;
