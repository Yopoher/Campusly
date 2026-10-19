-- Couche de compatibilité Supabase Storage pour les tests sur PostgreSQL nu (voir auth_shim.sql).
-- Ne jamais appliquer sur un projet Supabase : le schéma `storage` y existe déjà.
-- Reproduit seulement ce dont dépendent les migrations : tables buckets et objects (RLS activée),
-- fonction foldername, et les privilèges du rôle authenticated.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.buckets, storage.objects to authenticated, service_role;
grant select on storage.buckets to anon;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
