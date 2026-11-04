-- PREPARED, NOT APPLIED (do not db push without approval).
-- Follow-up to 20261105000002_label_colors.sql. Additive only: widens what is accepted, drops no data.
--  * the five default label colors (vermelho, amarelo, azul, laranja, verde) become valid ids next to the old swatches and "#RRGGBB";
--  * a person may keep up to 8 custom colors (was 5).
-- The app works today without it: label colors live behind LabelColorRepo (src/features/tasks/colors.ts, localStorage adapter).

-- 1. The shared domain accepts the new ids (the old values stay valid).
alter domain public.label_color drop constraint if exists label_color_check;
alter domain public.label_color
  add constraint label_color_check
  check (value ~ '^#[0-9A-Fa-f]{6}$' or value in ('cinza', 'lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'vermelho', 'amarelo', 'azul', 'laranja', 'verde'));

-- 2. Tags and tasks keep their own `swatch` column: same widening.
alter table public.tags drop constraint if exists tags_swatch_check;
alter table public.tags
  add constraint tags_swatch_check
  check (swatch ~ '^#[0-9A-Fa-f]{6}$' or swatch in ('lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'neutro', 'cinza', 'vermelho', 'amarelo', 'azul', 'laranja', 'verde'));

alter table public.tasks drop constraint if exists tasks_swatch_check;
alter table public.tasks
  add constraint tasks_swatch_check
  check (swatch ~ '^#[0-9A-Fa-f]{6}$' or swatch in ('lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'neutro', 'cinza', 'vermelho', 'amarelo', 'azul', 'laranja', 'verde'));

-- 3. Up to 8 saved custom colors per person.
alter table public.user_custom_colors drop constraint if exists user_custom_colors_colors_check;
alter table public.user_custom_colors
  add constraint user_custom_colors_colors_check check (cardinality(colors) <= 8);
