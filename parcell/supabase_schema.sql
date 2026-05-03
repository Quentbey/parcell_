-- ============================================================
-- PARCELL — Schéma Supabase
-- À coller dans l'éditeur SQL de ton projet Supabase
-- Dashboard → SQL Editor → New Query → Coller → Run
-- ============================================================

-- ── Extension UUID (activée par défaut sur Supabase) ──
create extension if not exists "uuid-ossp";

-- ════════════════════════════════════════
-- TABLE : profiles
-- Données utilisateur (complément auth.users)
-- ════════════════════════════════════════
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text not null,
  full_name     text,
  avatar_url    text,
  plan          text not null default 'free' check (plan in ('free', 'pro')),
  preferences   jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index
create index if not exists profiles_email_idx on public.profiles(email);

-- RLS : chaque utilisateur ne voit que son propre profil
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Trigger : crée automatiquement le profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ════════════════════════════════════════
-- TABLE : projects
-- Projets / simulations sauvegardés
-- ════════════════════════════════════════
create table if not exists public.projects (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,

  -- Infos du projet
  name          text not null,
  note          text,
  status        text default 'etude' check (status in ('etude','visite','offre','acquis','abandonne')),

  -- Localisation
  ville         text not null,
  quartier      text,

  -- Caractéristiques du bien
  type_bien     text default 'Apt' check (type_bien in ('Apt', 'Msn')),
  surface       numeric(8,2),
  pieces        integer,
  meuble        boolean default false,

  -- Finance
  prix_achat    numeric(12,2),
  loyer_mensuel numeric(10,2),

  -- KPIs calculés (snapshot au moment de la sauvegarde)
  rent_brute    text,
  rent_nette    text,
  mensualite    numeric(10,2),
  cashflow      numeric(10,2),

  -- Tous les paramètres avancés du simulateur (JSON)
  params        jsonb default '{}',

  -- Partage
  share_token   uuid unique default null,
  shared        boolean default false,

  -- Timestamps
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_share_token_idx on public.projects(share_token);
create index if not exists projects_created_at_idx on public.projects(created_at desc);

-- RLS : chaque utilisateur ne voit que ses projets
-- (+ les projets partagés publiquement)
alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (
    auth.uid() = user_id
    or shared = true  -- les projets partagés sont lisibles par tous
  );

create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);

create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- Trigger : met à jour updated_at automatiquement
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();


-- ════════════════════════════════════════
-- Vue optionnelle : projets publics (pour partage via lien)
-- ════════════════════════════════════════
create or replace view public.shared_projects as
select
  p.id, p.name, p.note, p.status,
  p.ville, p.quartier, p.type_bien, p.surface, p.pieces, p.meuble,
  p.prix_achat, p.loyer_mensuel,
  p.rent_brute, p.rent_nette, p.mensualite, p.cashflow,
  p.params, p.share_token,
  p.created_at,
  pr.full_name as owner_name
from public.projects p
left join public.profiles pr on p.user_id = pr.id
where p.shared = true;

-- ════════════════════════════════════════
-- Configuration auth Supabase
-- (dans Dashboard > Authentication > Providers)
-- ════════════════════════════════════════
-- ✅ Email : activer "Confirm email" pour vérification à l'inscription
-- ✅ Google : activer OAuth, ajouter Client ID et Client Secret
--    (depuis Google Cloud Console > APIs > Credentials)
-- ✅ Redirect URL : https://votre-app.netlify.app, http://localhost:3000

-- ════════════════════════════════════════
-- Vérification : doit retourner les tables créées
-- ════════════════════════════════════════
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
