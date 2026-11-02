-- Shared catalogs (reference data, not demo data) and storage buckets. Additive: inserts only rows that are missing and creates
-- new buckets / policies.

-- ---------------------------------------------------------------------------------------------------------------------
-- Foods (values close to the TACO table). user_id null = visible to everyone, editable by no user.
insert into public.foods (name, serving_label, kcal, protein_g, carbs_g, fat_g)
select v.name, v.serving_label, v.kcal, v.protein_g, v.carbs_g, v.fat_g
from (values
  ('Arroz branco cozido', '100 g', 128, 2.5, 28.1, 0.2),
  ('Feijão carioca cozido', '100 g', 76, 4.8, 13.6, 0.5),
  ('Peito de frango grelhado', '100 g', 159, 32, 0, 2.5),
  ('Ovo cozido', '1 unidade (50 g)', 78, 6.3, 0.6, 5.3),
  ('Pão francês', '1 unidade (50 g)', 150, 4.7, 29.4, 1.6),
  ('Café com leite', '1 xícara (150 ml)', 55, 3, 5, 2.5),
  ('Banana prata', '1 unidade (70 g)', 60, 0.8, 15.4, 0.1),
  ('Maçã', '1 unidade (130 g)', 70, 0.4, 18.6, 0.2),
  ('Iogurte natural', '1 pote (170 g)', 100, 6.5, 8, 4.5),
  ('Aveia em flocos', '3 colheres (30 g)', 117, 4.2, 20, 2.4),
  ('Whey protein', '1 dose (30 g)', 120, 24, 3, 1.5),
  ('Azeite de oliva', '1 colher de sopa (13 g)', 117, 0, 0, 13),
  ('Batata-doce cozida', '100 g', 77, 0.6, 18.4, 0.1),
  ('Salada de alface e tomate', '1 prato (100 g)', 20, 1, 4, 0.2),
  ('Tapioca com queijo', '1 unidade (80 g)', 190, 6, 30, 5),
  ('Pizza de mussarela', '1 fatia (100 g)', 270, 11, 33, 10),
  ('Carne moída refogada', '100 g', 212, 26, 0, 11),
  ('Macarrão cozido', '100 g', 158, 5.8, 30.9, 0.9)
) as v(name, serving_label, kcal, protein_g, carbs_g, fat_g)
where not exists (select 1 from public.foods f where f.user_id is null and f.name = v.name);

-- Exercises
insert into public.exercises (name, muscle_group)
select v.name, v.muscle_group
from (values
  ('Supino reto com barra', 'Peito'),
  ('Supino inclinado com halteres', 'Peito'),
  ('Crucifixo na máquina', 'Peito'),
  ('Tríceps na polia', 'Tríceps'),
  ('Tríceps testa', 'Tríceps'),
  ('Puxada frontal', 'Costas'),
  ('Remada curvada', 'Costas'),
  ('Remada baixa', 'Costas'),
  ('Rosca direta', 'Bíceps'),
  ('Rosca martelo', 'Bíceps'),
  ('Agachamento livre', 'Pernas'),
  ('Leg press 45°', 'Pernas'),
  ('Cadeira extensora', 'Pernas'),
  ('Mesa flexora', 'Pernas'),
  ('Panturrilha em pé', 'Panturrilhas')
) as v(name, muscle_group)
where not exists (select 1 from public.exercises e where e.user_id is null and e.name = v.name);

-- ---------------------------------------------------------------------------------------------------------------------
-- Storage: avatars and general attachments, one folder per user (`<user_id>/<file>`). Private buckets (signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('attachments', 'attachments', false, 10485760, null)
on conflict (id) do nothing;

do $$
declare
  b text;
begin
  foreach b in array array['avatars', 'attachments'] loop
    execute format($f$create policy %I on storage.objects for select to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b || '_select_own', b);
    execute format($f$create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b || '_insert_own', b);
    execute format($f$create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b || '_update_own', b, b);
    execute format($f$create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b || '_delete_own', b);
  end loop;
end;
$$;
