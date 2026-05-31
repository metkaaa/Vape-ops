-- Nur dieses Skript ausführen, wenn der Fehler
-- "column flavor does not exist" kam.
-- Danach schema.sql erneut ausführen (oder hier stoppen, wenn alles grün ist).

alter table public.sales add column if not exists flavor text;

create index if not exists sales_flavor_idx on public.sales (flavor);
