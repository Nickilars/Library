-- G1 : champ genre (liste prédéfinie validée côté client — voir GENRES dans
-- web/shelf-logic.mjs ; pas de contrainte DB pour pouvoir faire évoluer la liste
-- sans migration). Première migration versionnée du dépôt : le socle A (table books,
-- RLS, Auth) a été créé manuellement via le dashboard avant cette date.
--
-- À exécuter dans le SQL Editor du dashboard Supabase (ou `supabase db push`).

alter table public.books add column if not exists genre text;
