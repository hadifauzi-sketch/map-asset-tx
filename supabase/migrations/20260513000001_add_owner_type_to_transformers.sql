alter table public.transformers
  drop constraint if exists transformers_owner_type_check;

alter table public.transformers
  add column if not exists owner_type text;

update public.transformers
set owner_type = 'TNB'
where owner_type is null
   or owner_type not in ('TNB', 'Non-TNB');

alter table public.transformers
  alter column owner_type set default 'TNB',
  alter column owner_type set not null;

alter table public.transformers
  add constraint transformers_owner_type_check
  check (owner_type in ('TNB', 'Non-TNB'));

create index if not exists idx_transformers_owner_type
  on public.transformers(owner_type);
