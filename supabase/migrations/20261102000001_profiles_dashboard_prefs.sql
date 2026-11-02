-- Customizable "Hoje" page: which 4 highlight cards and which panels, in what order. Additive and backward compatible:
-- a nullable column with no default. NULL = "use the defaults". The app validates and versions the JSON (src/features/today/prefs.ts)
-- and falls back to a cookie / localStorage while this column does not exist yet.
--
-- profiles_update_own already lets people update their own row, so no policy changes are needed.

alter table public.profiles
  add column if not exists dashboard_prefs jsonb;
