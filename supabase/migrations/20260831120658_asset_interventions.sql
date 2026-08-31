-- ============================================================
-- Asset interventions (maintenance events)
-- ============================================================
-- Records what was physically done to the oil or the asset, and when.
--
-- Without this, a step change in trending is indistinguishable from a fault:
-- a filtration resets moisture and BDV, a degas or retrofill resets the whole
-- DGA baseline. These rows let the trending charts mark the date so a break in
-- the pattern can be read as maintenance rather than a developing failure.

create table if not exists public.asset_interventions (
  id                uuid        primary key default uuid_generate_v4(),
  transformer_id    uuid        references public.transformers(id) on delete cascade,
  event_date        date        not null,
  event_type        text        not null,
  -- Free-text so it matches the client-side compartment vocabulary in
  -- TransformerDetailModal (Maintank, OLTC, ...) without a migration per value.
  compartment       text,
  oil_volume_litres numeric,
  performed_by      text,
  notes             text,
  created_at        timestamptz default now()
);

create index if not exists idx_asset_interventions_transformer_date
  on public.asset_interventions (transformer_id, event_date desc);

alter table public.asset_interventions enable row level security;

-- Dropped first so the whole migration stays re-runnable; CREATE POLICY has no
-- IF NOT EXISTS form and would otherwise fail on a second apply.
drop policy if exists "anon_all" on public.asset_interventions;
create policy "anon_all" on public.asset_interventions for all using (true) with check (true);
