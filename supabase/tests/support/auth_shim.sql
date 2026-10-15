-- Couche de compatibilité Supabase pour exécuter les migrations et les tests
-- sur un PostgreSQL nu (développement local sans Docker, intégration continue).
-- Ne jamais appliquer sur un projet Supabase : le schéma `auth` y existe déjà.

-- Les rôles sont globaux au serveur : plusieurs bases de test peuvent être préparées en parallèle,
-- d'où la tolérance à une création simultanée par une autre session.
do $$
declare r record;
begin
  for r in select * from (values ('anon', ''), ('authenticated', ''), ('service_role', ' bypassrls')) as t(name, extra) loop
    begin
      if not exists (select 1 from pg_roles where rolname = r.name) then
        execute format('create role %I nologin%s', r.name, r.extra);
      end if;
    exception when duplicate_object or unique_violation then
      null; -- créé au même instant par une autre préparation de base
    end;
  end loop;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
