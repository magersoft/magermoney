create type public.currency_kind as enum ('fiat', 'crypto');

create table public.currencies (
  code text primary key check (code ~ '^[A-Z0-9]{2,10}$'),
  kind public.currency_kind not null,
  scale int not null check (scale between 0 and 18),
  symbol text,
  name_ru text,
  name_en text,
  icon text
);

alter table public.currencies enable row level security;
create policy "currencies: authenticated read" on public.currencies for select to authenticated using (true);

insert into public.currencies (code, kind, scale, symbol, name_ru, name_en, icon) values
  ('USD','fiat',2,null,null,null,null), ('EUR','fiat',2,null,null,null,null), ('RUB','fiat',2,null,null,null,null),
  ('KZT','fiat',2,null,null,null,null), ('UZS','fiat',2,null,null,null,null), ('IDR','fiat',2,null,null,null,null),
  ('EGP','fiat',2,null,null,null,null), ('GEL','fiat',2,null,null,null,null), ('KGS','fiat',2,null,null,null,null),
  ('BTC','crypto',8,'₿','Биткоин','Bitcoin',null), ('ETH','crypto',8,'Ξ','Эфириум','Ethereum',null),
  ('USDT','crypto',2,'₮','Tether','Tether',null), ('XRP','crypto',6,null,'XRP','XRP',null),
  ('SOL','crypto',6,null,'Solana','Solana',null), ('DOGE','crypto',4,null,'Dogecoin','Dogecoin',null),
  ('PEPE','crypto',8,null,'Pepe','Pepe',null), ('AVAX','crypto',6,null,'Avalanche','Avalanche',null),
  ('ATOM','crypto',6,null,'Cosmos','Cosmos',null), ('TRX','crypto',6,null,'Tron','Tron',null);

alter table public.profiles
  add constraint profiles_default_currency_fkey foreign key (default_currency) references public.currencies(code);
