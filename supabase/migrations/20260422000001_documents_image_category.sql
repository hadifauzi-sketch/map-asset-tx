-- ============================================================
-- Persist image category metadata in Supabase documents table
-- ============================================================

alter table public.documents
add column if not exists image_category text;

-- Backfill categories from older prefixed file names (imgcat-<category>--filename)
update public.documents
set image_category = lower(substring(file_name from '^imgcat-([a-z0-9-]+)--'))
where image_category is null
  and file_name ~* '^imgcat-([a-z0-9-]+)--'
  and lower(substring(file_name from '^imgcat-([a-z0-9-]+)--')) in (
    'name-plate',
    'transformer-design',
    'oil-level-design',
    'oltc-design',
    'buchholz-design',
    'other'
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_image_category_check'
  ) then
    alter table public.documents
    add constraint documents_image_category_check
    check (
      image_category in (
        'name-plate',
        'transformer-design',
        'oil-level-design',
        'oltc-design',
        'buchholz-design',
        'other'
      )
    );
  end if;
end $$;

create index if not exists idx_documents_image_category on public.documents(image_category);
