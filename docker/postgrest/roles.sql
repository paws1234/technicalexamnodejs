-- Local stack only. PostgREST runs every request as the role named in the JWT, so the
-- two roles the local keys claim have to exist with the grants a Supabase project hands
-- out by default. The guards make this file harmless on a real Supabase project, where
-- both roles already exist and `create role` would otherwise error.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

grant usage on schema public to anon, service_role;
grant select on all tables in schema public to anon; -- read-only: the sync never uses anon
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant all on tables to service_role;
