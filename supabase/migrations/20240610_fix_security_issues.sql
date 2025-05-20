-- Migración para solucionar errores críticos de seguridad en Supabase

-------------------------------------------------------------------------
-- 1. Activar RLS en tablas que tienen políticas pero RLS desactivado
-------------------------------------------------------------------------

-- 1.1 Tabla public.categorias - Habilitar RLS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Verificación: Las políticas ya existen según el error detectado, pero dejamos comentados los comandos
-- para crearlas en caso de que sea necesario regenerarlas:
/*
CREATE POLICY "Usuarios pueden ver sus propias categorias" 
  ON public.categorias FOR SELECT 
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuarios pueden insertar sus propias categorias" 
  ON public.categorias FOR INSERT 
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuarios pueden actualizar sus propias categorias" 
  ON public.categorias FOR UPDATE 
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuarios pueden eliminar sus propias categorias" 
  ON public.categorias FOR DELETE 
  USING (user_id = (SELECT auth.uid()));
*/

-------------------------------------------------------------------------
-- 2. Modificar vista SECURITY DEFINER a SECURITY INVOKER
-------------------------------------------------------------------------

-- 2.1 Modificar vista_cuotas_expandidas para usar SECURITY INVOKER
ALTER VIEW public.vista_cuotas_expandidas SET (security_invoker = true);

-- Si el comando anterior falla (por ejemplo, si la vista no tiene la propiedad configurable),
-- necesitamos recrear la vista. Dejamos comentado el comando para recrearla:
/*
CREATE OR REPLACE VIEW public.vista_cuotas_expandidas 
WITH (security_invoker = true) 
AS
-- Aquí iría la definición actual de la vista
-- SELECT ... FROM ... WHERE ...;
*/

-------------------------------------------------------------------------
-- 3. Activar RLS en tablas públicas que no tienen RLS habilitado
-------------------------------------------------------------------------

-- 3.1 Tabla public.compras_cuotas - Habilitar RLS
ALTER TABLE public.compras_cuotas ENABLE ROW LEVEL SECURITY;

-- Política básica para compras_cuotas - Asumimos que el usuario debe ver/modificar solo sus propias cuotas
-- (ajustar según la estructura real de la tabla y los requisitos de negocio)
CREATE POLICY "Los usuarios pueden gestionar sus propias cuotas de compra" 
  ON public.compras_cuotas FOR ALL
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 3.2 Tabla public.business_profile - Habilitar RLS
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

-- Política básica para business_profile - Asumimos que el usuario debe ver/modificar solo su propio perfil
-- (ajustar según la estructura real de la tabla y los requisitos de negocio)
CREATE POLICY "Los usuarios pueden gestionar su propio perfil de negocio" 
  ON public.business_profile FOR ALL
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Política alternativa si el perfil de negocio debe ser visible para todos los usuarios autenticados
-- pero solo modificable por su propietario
/*
CREATE POLICY "Todos los usuarios pueden ver perfiles de negocio" 
  ON public.business_profile FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Los usuarios pueden modificar su propio perfil de negocio" 
  ON public.business_profile FOR INSERT UPDATE DELETE
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));
*/

-------------------------------------------------------------------------
-- 4. Verificación de la aplicación de los cambios
-------------------------------------------------------------------------

-- 4.1 Verificar que RLS esté habilitado en las tablas objetivo
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('categorias', 'compras_cuotas', 'business_profile');

-- 4.2 Verificar políticas existentes para las tablas objetivo
SELECT tablename, policyname, permissive, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename IN ('categorias', 'compras_cuotas', 'business_profile')
ORDER BY tablename, policyname;

-- 4.3 Verificar la propiedad security_invoker de la vista
SELECT viewname, CASE WHEN pg_catalog.obj_description(c.oid, 'pg_class') LIKE '%security_invoker%' THEN 'invoker' ELSE 'definer' END AS security
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname = 'vista_cuotas_expandidas'; 