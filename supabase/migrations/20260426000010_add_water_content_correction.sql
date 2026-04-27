alter table public.oil_tests
  add column if not exists water_content_temperature numeric;

alter table public.oil_tests
  add column if not exists water_content_basis text;

alter table public.oil_tests
  add constraint oil_tests_water_content_basis_check
    check (water_content_basis is null or water_content_basis in ('measured', 'normalized_20c'));

comment on column public.oil_tests.water_content_temperature is
  'Sampling temperature in Celsius for the water content measurement. Required to apply IEC 60422 Annex C normalization.';
comment on column public.oil_tests.water_content_basis is
  'Whether water_content is the raw value at sampling temperature (measured) or normalized to 20 C per IEC 60422 Annex C (normalized_20c).';
