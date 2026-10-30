-- Eenmalig uitvoeren in Supabase: SQL Editor → New query → plakken → Run.
-- Eén rij per gebruiker per onderdeel (profiel, aanpassingen, resultaten). Je ziet alleen je eigen rijen.
create table if not exists public.app_gegevens (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  naam text not null check (naam in ('profiel', 'aanpassingen', 'resultaten')),
  waarde text not null,
  bijgewerkt timestamptz not null default now(),
  primary key (user_id, naam)
);

alter table public.app_gegevens enable row level security;

drop policy if exists "eigen gegevens" on public.app_gegevens;
create policy "eigen gegevens" on public.app_gegevens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.app_gegevens to authenticated;
