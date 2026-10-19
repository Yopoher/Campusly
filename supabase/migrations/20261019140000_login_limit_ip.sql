-- Limites des demandes de code : 20 par adresse et par heure, 500 par adresse IP et par heure.
-- La limite IP est relevée pour ne pas bloquer un réseau d'école partagé. Remplace la fonction de la migration 20261019130000.
create or replace function login_precheck(p_email text, p_ip_hash text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_hash text := email_hash(p_email);
begin
  if (select count(*) from login_attempts where email_hash = v_hash and created_at > now() - interval '1 hour') >= 20
     or (p_ip_hash is not null and
         (select count(*) from login_attempts where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 500)
  then
    return 'throttled';
  end if;
  insert into login_attempts (email_hash, ip_hash) values (v_hash, p_ip_hash);
  return case when can_request_login(p_email) then 'ok' else 'denied' end;
end $$;
