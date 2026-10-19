-- Modification d'une école par le super-administrateur : nom, fuseau horaire et domaines e-mail.
-- Un domaine ne peut pas être retiré tant qu'une adresse autorisée l'utilise. Aucune suppression définitive :
-- une école se désactive (admin_set_school_status), ce qui conserve l'historique.
create or replace function admin_update_school(p_school uuid, p_name text, p_timezone text, p_domains text[])
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_domains text[];
  v_removed text[];
  v_domain  text;
begin
  perform assert_platform_admin();
  if not exists (select 1 from schools where id = p_school) then
    raise exception 'École introuvable' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Le nom doit contenir entre 2 et 120 caractères' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Fuseau horaire inconnu : %', p_timezone using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct lower(btrim(d))), '{}') into v_domains from unnest(coalesce(p_domains, '{}')) as d
  where btrim(d) <> '';
  if cardinality(v_domains) = 0 then
    raise exception 'Au moins un domaine e-mail est requis' using errcode = '22023';
  end if;
  foreach v_domain in array v_domains loop
    if v_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
      raise exception 'Domaine invalide : %', v_domain using errcode = '22023';
    end if;
  end loop;

  select coalesce(array_agg(domain order by domain), '{}') into v_removed
  from school_domains where school_id = p_school and not (domain = any (v_domains));
  if exists (
    select 1 from allowed_emails
    where school_id = p_school and status = 'authorized'
      and split_part(email, '@', 2) = any (v_removed)
  ) then
    raise exception 'Des adresses autorisées utilisent un domaine à retirer : retire-les d''abord' using errcode = '22023';
  end if;

  update schools set name = btrim(p_name), timezone = p_timezone where id = p_school;
  delete from school_domains where school_id = p_school and domain = any (v_removed);
  insert into school_domains (school_id, domain)
  select p_school, d from unnest(v_domains) as d
  on conflict do nothing;

  perform write_audit(p_school, 'school.updated', 'school', p_school::text,
                      jsonb_build_object('name', btrim(p_name), 'timezone', p_timezone, 'domains', v_domains));
end $$;

revoke all on function admin_update_school(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function admin_update_school(uuid, text, text, text[]) to authenticated;
