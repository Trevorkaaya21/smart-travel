do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'trip_items_place_id_fkey'
      and table_name = 'trip_items'
  ) then
    alter table trip_items drop constraint trip_items_place_id_fkey;
  end if;
end $$;

alter table trip_items
  add constraint trip_items_place_id_fkey
  foreign key (place_id)
  references places(id)
  on delete cascade;
