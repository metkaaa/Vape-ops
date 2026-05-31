-- Migration für bestehende VAPE OPS Datenbank
-- SQL Editor → Run

alter table public.sales add column if not exists flavor text;

create index if not exists sales_flavor_idx on public.sales (flavor);

-- Optional: alte Verkäufe markieren (Lager zählt nur Verkäufe mit flavor)
-- update public.sales set flavor = 'legacy' where flavor is null;
