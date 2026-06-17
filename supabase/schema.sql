-- VAPE SHOP — Supabase Schema
-- SQL Editor → New query → Run (ganzes Skript)

-- ── 1. Verkäufe (kompatibel mit bestehender Tabelle) ──
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  seller text not null check (seller in ('Aron', 'Mehmet')),
  buyer_name text not null,
  price numeric(10, 2) not null check (price > 0),
  qty integer not null check (qty > 0),
  revenue numeric(10, 2) not null,
  cost numeric(10, 2) not null,
  profit numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

-- WICHTIG: Spalte zuerst anlegen, DANN Index (sonst: column "flavor" does not exist)
alter table public.sales add column if not exists flavor text;

create index if not exists sales_seller_created_idx
  on public.sales (seller, created_at);

create index if not exists sales_flavor_idx
  on public.sales (flavor);

-- ── 2. Geschmacks-Sorten (Startbestand) ──
create table if not exists public.flavors (
  id text primary key,
  name text not null,
  initial_qty integer not null check (initial_qty > 0),
  sort_order integer not null default 0,
  holder text not null default 'Aron' check (holder in ('Aron', 'Mehmet'))
);

alter table public.flavors add column if not exists holder text not null default 'Aron';

insert into public.flavors (id, name, initial_qty, sort_order, holder) values
  ('cherry', 'Cherry', 10, 1, 'Aron'),
  ('strawberry-ice', 'Strawberry Ice', 10, 2, 'Mehmet'),
  ('pink-lemonade', 'Pink Lemonade', 10, 3, 'Aron'),
  ('blueberry-on-ice', 'Blueberry on Ice', 10, 4, 'Mehmet'),
  ('kiwi-passionfruit-guava', 'Kiwi Passionfruit Guava', 10, 5, 'Aron'),
  ('strawberry-kiwi', 'Strawberry Kiwi', 10, 6, 'Mehmet'),
  ('peach-ice', 'Peach Ice', 10, 7, 'Aron'),
  ('blue-razz-lemonade', 'Blue Razz Lemonade', 10, 8, 'Mehmet'),
  ('blue-sour-raspberry', 'Blue Sour Raspberry', 10, 9, 'Aron'),
  ('blueberry-cherry-cranberry', 'Blueberry Cherry Cranberry', 10, 10, 'Mehmet'),
  ('cherry-berry', 'Cherry Berry', 10, 11, 'Aron'),
  ('bingo-crush', 'Bingo Crush', 10, 12, 'Mehmet'),
  ('pineapple-ice', 'Pineapple Ice', 10, 13, 'Aron'),
  ('strawberry-grape', 'Strawberry Grape', 20, 14, 'Mehmet'),
  ('fruity-fusion', 'Fruity Fusion', 10, 15, 'Aron')
on conflict (id) do update set
  name = excluded.name,
  initial_qty = excluded.initial_qty,
  sort_order = excluded.sort_order,
  holder = excluded.holder;

-- ── 3. Kundenbestellungen (Shop, getrennt von sales) ──
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  flavor text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(10, 2) not null check (unit_price > 0),
  total numeric(10, 2) not null check (total > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists orders_flavor_idx
  on public.orders (flavor);

-- ── 4. Öffentlicher Shop-Preis (12 €, getrennt von Verkäufer-Verkäufen) ──
create table if not exists public.shop_settings (
  id integer primary key default 1 check (id = 1),
  public_price numeric(10, 2) not null default 12.00,
  updated_at timestamptz not null default now()
);

insert into public.shop_settings (id, public_price)
values (1, 12.00)
on conflict (id) do nothing;

-- ── 5. Row Level Security ──
alter table public.sales enable row level security;
alter table public.flavors enable row level security;
alter table public.orders enable row level security;
alter table public.shop_settings enable row level security;

drop policy if exists "sales_select" on public.sales;
drop policy if exists "sales_insert" on public.sales;
drop policy if exists "sales_update" on public.sales;
drop policy if exists "sales_delete" on public.sales;

create policy "sales_select" on public.sales for select using (true);
create policy "sales_insert" on public.sales
  for insert to authenticated with check (true);
create policy "sales_update" on public.sales
  for update to authenticated using (true);
create policy "sales_delete" on public.sales
  for delete to authenticated using (true);

drop policy if exists "flavors_select" on public.flavors;
create policy "flavors_select" on public.flavors for select using (true);

drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;

create policy "orders_select" on public.orders for select using (true);
create policy "orders_insert" on public.orders for insert with check (true);
create policy "orders_update" on public.orders
  for update to authenticated using (true);

drop policy if exists "shop_settings_select" on public.shop_settings;
drop policy if exists "shop_settings_update" on public.shop_settings;

create policy "shop_settings_select" on public.shop_settings for select using (true);
create policy "shop_settings_update" on public.shop_settings for update using (true);

-- Realtime (optional): Database → Replication → sales, orders, shop_settings aktivieren
