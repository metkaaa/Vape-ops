-- Einmal im SQL Editor ausführen (bestehende Datenbank)

insert into public.flavors (id, name, initial_qty, sort_order) values
  ('fruity-fusion', 'Fruity Fusion', 10, 15)
on conflict (id) do update set
  name = excluded.name,
  initial_qty = excluded.initial_qty,
  sort_order = excluded.sort_order;
