-- ============================================================
-- Transformer Asset Map — Initial Schema
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── transformers ─────────────────────────────────────────────
create table if not exists public.transformers (
  id                    uuid        primary key default uuid_generate_v4(),
  site_name             text        not null,
  tx_name               text        not null,
  mnemonic              text,
  serial_number         text,
  voltage               text        not null default '',
  load_mva              text,
  maker                 text,
  year_built            text,
  latitude              numeric     not null,
  longitude             numeric     not null,
  state                 text,
  dga_oil_type          text,
  dga_gas_limit_standard text,
  dga_method_view       text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.transformers enable row level security;
create policy "anon_all" on public.transformers for all using (true) with check (true);

-- ── oil_tests ─────────────────────────────────────────────────
create table if not exists public.oil_tests (
  id                    uuid        primary key default uuid_generate_v4(),
  transformer_id        uuid        references public.transformers(id) on delete cascade,
  test_date             date        not null,
  test_type             text        not null,
  -- Physical & Chemical
  breakdown             numeric,
  acidity               numeric,
  water_content         numeric,
  interfacial_tension   numeric,
  color                 text,
  flash_point           numeric,
  dielectric_strength   numeric,
  power_factor          numeric,
  inhibitor             numeric,
  copper_corrosive      text,
  density               numeric,
  dbds                  numeric,
  viscosity_40          numeric,
  methanol              numeric,
  pcb                   numeric,
  resistivity           numeric,
  specific_gravity      numeric,
  passivator            numeric,
  -- DGA
  h2                    integer,
  ch4                   integer,
  c2h6                  integer,
  c2h4                  integer,
  c2h2                  integer,
  co                    integer,
  co2                   integer,
  o2                    integer,
  n2                    integer,
  tdcg                  numeric,
  -- Furanic Compounds
  fol_2                 numeric,
  hmf_5                 numeric,
  fal_2                 numeric,
  acf_2                 numeric,
  mef_5                 numeric,
  -- Metals-in-Oil
  copper_cu             numeric,
  iron_fe               numeric,
  aluminum_al           numeric,
  -- Estimated DP
  estimated_dp_furan    numeric,
  estimated_dp_methanol numeric,
  notes                 text,
  created_at            timestamptz default now()
);

alter table public.oil_tests enable row level security;
create policy "anon_all" on public.oil_tests for all using (true) with check (true);

-- ── documents ─────────────────────────────────────────────────
create table if not exists public.documents (
  id              uuid        primary key default uuid_generate_v4(),
  transformer_id  uuid        references public.transformers(id) on delete cascade,
  file_name       text        not null,
  file_type       text        not null,
  file_size       bigint      not null,
  storage_path    text        not null,
  uploaded_at     timestamptz default now()
);

alter table public.documents enable row level security;
create policy "anon_all" on public.documents for all using (true) with check (true);

-- ── floor_plans ───────────────────────────────────────────────
create table if not exists public.floor_plans (
  id              text        primary key,
  name            text        not null default '',
  company_name    text        not null default '',
  state           text        not null default '',
  points          jsonb       not null default '[]'::jsonb,
  transformer_ids text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.floor_plans enable row level security;
create policy "anon_all" on public.floor_plans for all using (true) with check (true);
