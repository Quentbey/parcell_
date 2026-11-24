-- Newsletter + formulaire de contact de la page d'accueil.
-- Les visiteurs (anon) peuvent seulement insérer ; seuls les admins lisent.
create table if not exists public.leads (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('newsletter','contact')),
  email       text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name        text check (char_length(name) <= 120),
  message     text check (char_length(message) <= 5000),
  page        text check (char_length(page) <= 300),
  created_at  timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy leads_insert_public on public.leads
  for insert to anon, authenticated
  with check (true);

create policy leads_select_admin on public.leads
  for select to authenticated
  using (public.is_admin());

grant insert on public.leads to anon, authenticated;
grant select on public.leads to authenticated;
