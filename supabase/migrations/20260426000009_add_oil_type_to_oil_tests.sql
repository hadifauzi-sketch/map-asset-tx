alter table public.oil_tests
  add column if not exists oil_type text;

update public.oil_tests
set oil_type = 'Mineral Oil'
where oil_type is null;

alter table public.oil_tests
  alter column oil_type set default 'Mineral Oil';
