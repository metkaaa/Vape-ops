-- In Supabase: SQL Editor → New query → einfügen → Run

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

create index if not exists sales_seller_created_idx
  on public.sales (seller, created_at);

alter table public.sales enable row level security;

-- Öffentlicher Zugriff über anon key (kleines Team-Tool).
-- Für mehr Sicherheit später: Auth oder Secret-Header ergänzen.
create policy "sales_select" on public.sales
  for select using (true);

create policy "sales_insert" on public.sales
  for insert with check (true);

create policy "sales_delete" on public.sales
  for delete using (true);

-- Realtime (optional): Supabase → Database → Replication → sales aktivieren
-- Dann sehen Aron & Mehmet Änderungen live auf verschiedenen Geräten.
