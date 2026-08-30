-- Weather readings kept per site + date, so the Weather History panel can still show
-- data when Open-Meteo is unreachable.
--   source = 'api'    -> cached automatically after a successful Open-Meteo fetch
--   source = 'manual' -> typed in by a user, and always wins over the cached row
create table if not exists public.weather_observations (
  id                    uuid        primary key default gen_random_uuid(),
  site_name             text        not null,
  observed_date         date        not null,
  source                text        not null default 'manual',
  temperature           double precision,
  humidity              double precision,
  rain                  double precision,
  precipitation         double precision,
  wind_speed            double precision,
  dew_point             double precision,
  weather_code          integer,
  weather_label         text        not null default '',
  is_rainy              boolean     not null default false,
  observation_time      text        not null default '',
  timezone              text        not null default '',
  timezone_abbreviation text        not null default '',
  note                  text        not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint weather_observations_source_check check (source in ('api', 'manual'))
);

alter table public.weather_observations enable row level security;

drop policy if exists "anon_all" on public.weather_observations;
create policy "anon_all" on public.weather_observations for all using (true) with check (true);

-- One row per site per date per source; upserts target this constraint.
create unique index if not exists idx_weather_observations_site_date_source
  on public.weather_observations(site_name, observed_date, source);

create index if not exists idx_weather_observations_observed_date
  on public.weather_observations(observed_date);

create or replace function public.set_weather_observations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weather_observations_updated_at on public.weather_observations;
create trigger trg_weather_observations_updated_at
  before update on public.weather_observations
  for each row execute function public.set_weather_observations_updated_at();
