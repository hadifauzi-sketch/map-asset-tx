with serials as (
  select
    id,
    site_name,
    tx_name,
    mnemonic,
    serial_number,
    nullif(
      regexp_replace(lower(btrim(coalesce(serial_number, ''))), '[^a-z0-9]+', '', 'g'),
      ''
    ) as serial_number_normalized
  from public.transformers
)
select
  serial_number_normalized,
  count(*) as asset_count,
  string_agg(
    site_name || ' / ' || tx_name || ' / ' || coalesce(mnemonic, '(no mnemonic)') || ' / SN ' || coalesce(serial_number, '(blank)'),
    ' || ' order by site_name, tx_name
  ) as assets
from serials
where serial_number_normalized is not null
group by serial_number_normalized
having count(*) > 1
order by asset_count desc, serial_number_normalized;
