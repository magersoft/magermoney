-- Fake rates so local and staging have something to convert with. Never real user data.
insert into public.rates (base, value, date, source) values
  ('EUR', 1.16, current_date, 'api'), ('RUB', 0.011911, current_date, 'api'), ('KZT', 0.002218, current_date, 'api'),
  ('UZS', 0.0000847, current_date, 'api'), ('BTC', 77389.36, current_date, 'api'), ('USDT', 1, current_date, 'api')
on conflict do nothing;
