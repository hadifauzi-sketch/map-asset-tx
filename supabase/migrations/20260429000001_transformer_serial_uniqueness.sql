-- ============================================================
-- Enforce unique transformer serial numbers (normalized)
-- ============================================================

-- Trim legacy values first so blank strings become NULL consistently.
update public.transformers
set serial_number = nullif(btrim(serial_number), '')
where serial_number is distinct from nullif(btrim(serial_number), '');

-- Drop older helper objects if they were created during a partial/manual attempt.
drop trigger if exists trg_normalize_transformer_serial_number on public.transformers;
drop function if exists public.normalize_transformer_serial_number_trigger();
drop function if exists public.normalize_transformer_serial(text);

-- Store a normalized serial for uniqueness:
-- lowercased, trimmed, and stripped of spaces/dashes/symbols.
alter table public.transformers
  add column if not exists serial_number_normalized text
  generated always as (
    nullif(
      regexp_replace(lower(btrim(coalesce(serial_number, ''))), '[^a-z0-9]+', '', 'g'),
      ''
    )
  ) stored;

create unique index if not exists idx_transformers_serial_number_normalized_unique
on public.transformers (serial_number_normalized)
where serial_number_normalized is not null;
