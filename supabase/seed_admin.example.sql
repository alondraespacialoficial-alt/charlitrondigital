-- ============================================================================
-- SEED MANUAL — primer administrador
-- NO versionar con datos reales. Ejecutar a mano en SQL Editor tras 0001_init.
--
-- Pasos:
--  1. En Supabase Dashboard → Authentication → Users → "Add user"
--     Crear el usuario admin con email + contraseña fuerte.
--  2. Copiar el UUID del usuario creado.
--  3. Ejecutar el INSERT de abajo reemplazando los valores.
-- ============================================================================

-- insert into public.admin_users (user_id)
-- values ('00000000-0000-0000-0000-000000000000');  -- ← UUID real del usuario Auth

-- Categorías iniciales sugeridas (opcional):
-- insert into public.categories (name, slug, description) values
--   ('Desarrollo web', 'desarrollo-web', 'Webs y apps para negocios'),
--   ('Automatización e IA', 'automatizacion-ia', 'Procesos, automatización e IA práctica'),
--   ('Marketing local', 'marketing-local', 'BTL, perifoneo y presencia local');
