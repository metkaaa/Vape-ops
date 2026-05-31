-- Einmal ausführen, wenn die Tabelle orders noch fehlt

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

alter table public.orders enable row level security;

drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;

create policy "orders_select" on public.orders for select using (true);
create policy "orders_insert" on public.orders for insert with check (true);
create policy "orders_update" on public.orders for update using (true);
