-- Lagerort A/M pro Sorte (einmal ausführen)

alter table public.flavors add column if not exists holder text default 'Aron';

update public.flavors set holder = 'Aron' where id in (
  'cherry', 'pink-lemonade', 'kiwi-passionfruit-guava', 'peach-ice',
  'blue-sour-raspberry', 'cherry-berry', 'pineapple-ice', 'fruity-fusion'
);

update public.flavors set holder = 'Mehmet' where id in (
  'strawberry-ice', 'blueberry-on-ice', 'strawberry-kiwi', 'blue-razz-lemonade',
  'blueberry-cherry-cranberry', 'bingo-crush', 'strawberry-grape'
);

alter table public.flavors alter column holder set default 'Aron';
