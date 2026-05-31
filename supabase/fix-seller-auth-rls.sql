-- Verkäufer-Aktionen nur mit Supabase-Login (authenticated)
-- Kunden: Bestellungen einreichen (insert) bleibt für alle

drop policy if exists "sales_insert" on public.sales;
drop policy if exists "sales_update" on public.sales;
drop policy if exists "sales_delete" on public.sales;
drop policy if exists "orders_update" on public.orders;

create policy "sales_insert" on public.sales
  for insert to authenticated with check (true);

create policy "sales_update" on public.sales
  for update to authenticated using (true);

create policy "sales_delete" on public.sales
  for delete to authenticated using (true);

create policy "orders_update" on public.orders
  for update to authenticated using (true);
