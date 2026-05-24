create table if not exists public.company_boundaries (
  id           text        primary key,
  company_name text        not null default '',
  state        text        not null default '',
  notes        text        not null default '',
  points       jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.company_boundaries enable row level security;

drop policy if exists "anon_all" on public.company_boundaries;
create policy "anon_all" on public.company_boundaries for all using (true) with check (true);

create index if not exists idx_company_boundaries_company_name on public.company_boundaries(company_name);
create index if not exists idx_company_boundaries_state on public.company_boundaries(state);
