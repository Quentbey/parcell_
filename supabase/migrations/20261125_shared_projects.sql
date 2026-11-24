-- Partage de projet par lien secret.
-- Avant : la policy SELECT laissait tout utilisateur connecté lire TOUS les projets partagés.
-- Après : seul le propriétaire (ou un admin) lit ses projets ; un projet partagé se lit
-- uniquement avec son token, via la fonction get_shared_project (sans les infos du propriétaire).

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select using ((auth.uid() = user_id) or public.is_admin());

create or replace function public.get_shared_project(token uuid)
returns table (
  name text, ville text, quartier text, type_bien text, surface numeric, pieces integer,
  meuble boolean, prix_achat numeric, loyer_mensuel numeric, params jsonb
)
language sql stable security definer set search_path = public as $$
  select name, ville, quartier, type_bien, surface, pieces, meuble, prix_achat, loyer_mensuel, params
  from public.projects
  where share_token = token and shared = true
  limit 1;
$$;

revoke all on function public.get_shared_project(uuid) from public;
grant execute on function public.get_shared_project(uuid) to anon, authenticated;
