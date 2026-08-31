-- ============================================================
-- Ethanol in oil tests
-- ============================================================
-- Methanol and ethanol are cellulose degradation markers alongside furan.
-- Methanol is the more sensitive early indicator (and works on thermally
-- upgraded paper, where furan under-reports), with ethanol as the companion
-- alcohol. The table already stored methanol; ethanol had no home.

alter table public.oil_tests
  add column if not exists ethanol numeric;

comment on column public.oil_tests.ethanol is
  'Ethanol (ppm) — cellulose degradation marker, reported alongside methanol.';
