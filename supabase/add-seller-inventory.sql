-- Verkäufer-Lager (einmal ausführen)

create table if not exists public.seller_inventory (
  seller text not null check (seller in ('Aron', 'Mehmet')),
  flavor_id text not null references public.flavors (id) on delete cascade,
  qty integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (seller, flavor_id)
);

create index if not exists seller_inventory_flavor_idx
  on public.seller_inventory (flavor_id);

alter table public.seller_inventory enable row level security;

drop policy if exists "seller_inventory_select" on public.seller_inventory;
drop policy if exists "seller_inventory_insert" on public.seller_inventory;
drop policy if exists "seller_inventory_update" on public.seller_inventory;

create policy "seller_inventory_select" on public.seller_inventory for select using (true);
create policy "seller_inventory_insert" on public.seller_inventory
  for insert to authenticated with check (true);
create policy "seller_inventory_update" on public.seller_inventory
  for update to authenticated using (true);

-- Replication: seller_inventory für Live-Updates aktivieren
