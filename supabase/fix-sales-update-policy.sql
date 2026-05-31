-- Einmal ausführen, damit Sorten-Nachbearbeitung in der Cloud funktioniert

drop policy if exists "sales_update" on public.sales;
create policy "sales_update" on public.sales for update using (true);
