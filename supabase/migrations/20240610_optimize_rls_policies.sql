-- Migraciones para optimizar las políticas RLS

-------------------------------------------------------------------------
-- 1. Optimización de políticas que usan auth.uid() directamente
-- Problema: Las políticas que usan auth.uid() directamente fuerzan una evaluación fila por fila,
-- lo que afecta el rendimiento cuando se trabaja con muchos registros
-------------------------------------------------------------------------

-- 1.1 Optimizar política para la tabla "productos"
DROP POLICY IF EXISTS "Productos: Acceso total para propietarios" ON public.productos;
CREATE POLICY "Productos: Acceso total para propietarios" 
  ON public.productos FOR ALL 
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 1.2 Optimizar política para la tabla "clientes"
DROP POLICY IF EXISTS "Los usuarios pueden gestionar sus propios clientes" ON public.clientes;
CREATE POLICY "Los usuarios pueden gestionar sus propios clientes" 
  ON public.clientes FOR ALL 
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 1.3 Optimizar política para la tabla "ventas"
DROP POLICY IF EXISTS "Los usuarios pueden gestionar sus propias ventas" ON public.ventas;
CREATE POLICY "Los usuarios pueden gestionar sus propias ventas" 
  ON public.ventas FOR ALL 
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 1.4 Optimizar política para la tabla "ventas_items"
DROP POLICY IF EXISTS "Los usuarios pueden gestionar sus propios items de venta" ON public.ventas_items;
CREATE POLICY "Los usuarios pueden gestionar sus propios items de venta" 
  ON public.ventas_items FOR ALL 
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 1.5 Optimizar política para la tabla "ventas_pagos"
DROP POLICY IF EXISTS "Los usuarios pueden gestionar sus propios pagos de venta" ON public.ventas_pagos;
CREATE POLICY "Los usuarios pueden gestionar sus propios pagos de venta" 
  ON public.ventas_pagos FOR ALL 
  USING (user_id = (SELECT auth.uid())) 
  WITH CHECK (user_id = (SELECT auth.uid()));

-------------------------------------------------------------------------
-- 2. Consolidación de múltiples políticas permisivas
-- Problema: Cuando hay varias políticas permisivas para la misma operación, 
-- PostgreSQL usa un OR entre ellas, lo que puede ser ineficiente
-------------------------------------------------------------------------

-- Listar políticas existentes para consolidar (comentado, esto es solo para referencia)
-- SELECT 
--   tablename, policyname, permissive, cmd, roles, qual, with_check
-- FROM 
--   pg_policies 
-- WHERE 
--   schemaname = 'public'
-- ORDER BY 
--   tablename;

-- Para consolidar políticas permisivas específicas, primero necesitaríamos 
-- identificarlas mediante el comando anterior y luego crear funciones específicas
-- que combinen las diferentes condiciones para cada caso particular.

-- Ejemplo de una función para consolidar políticas (sin implementar hasta identificar casos específicos):
-- CREATE OR REPLACE FUNCTION check_user_access(record_user_id UUID) 
-- RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN record_user_id = auth.uid() OR 
--          EXISTS (SELECT 1 FROM user_teams WHERE team_id = record_team_id AND user_id = auth.uid());
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Para implementar las consolidaciones específicas, se necesitaría analizar cada grupo 
-- de políticas permisivas caso por caso, identificando las tablas afectadas y la lógica de combinación adecuada. 