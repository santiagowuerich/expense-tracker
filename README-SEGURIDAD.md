# Solución de Problemas de Seguridad en Supabase

Este documento describe los problemas de seguridad identificados en la base de datos Supabase y los pasos para solucionarlos.

## Problemas Detectados

El linter de Supabase identificó los siguientes errores de seguridad críticos:

### 1. `policy_exists_rls_disabled` (Error de Seguridad)

- **Problema**: Se han creado políticas RLS para tablas que no tienen activado RLS.
- **Detalles**: La tabla `public.categorias` tiene políticas como "Usuarios pueden actualizar sus propias categorias", pero RLS está desactivado.
- **Riesgo**: Las políticas no se aplican, permitiendo acceso no controlado a los datos.

### 2. `security_definer_view` (Error de Seguridad)

- **Problema**: La vista `public.vista_cuotas_expandidas` está definida con SECURITY DEFINER.
- **Riesgo**: Se ejecuta con los permisos del creador de la vista, no del usuario que la consulta, lo que puede permitir acceso a datos que normalmente estarían restringidos.

### 3. `rls_disabled_in_public` (Error de Seguridad)

- **Problema**: Varias tablas en el esquema público no tienen RLS habilitado.
- **Tablas afectadas**: 
  - `public.compras_cuotas`
  - `public.categorias`
  - `public.business_profile`
- **Riesgo**: Sin RLS, cualquier usuario con permisos a nivel de tabla puede acceder o modificar todos los registros, sin restricciones por usuario.

## Solución Implementada

Se ha creado un script SQL (`20240610_fix_security_issues.sql`) para solucionar estos problemas:

1. **Activación de RLS en tablas que lo necesitan**:
   ```sql
   ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.compras_cuotas ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
   ```

2. **Cambio de SECURITY DEFINER a SECURITY INVOKER en la vista**:
   ```sql
   ALTER VIEW public.vista_cuotas_expandidas SET (security_invoker = true);
   ```

3. **Creación de políticas RLS básicas** para las tablas que no las tenían:
   ```sql
   CREATE POLICY "Los usuarios pueden gestionar sus propias cuotas de compra" 
     ON public.compras_cuotas FOR ALL
     USING (user_id = (SELECT auth.uid())) 
     WITH CHECK (user_id = (SELECT auth.uid()));

   CREATE POLICY "Los usuarios pueden gestionar su propio perfil de negocio" 
     ON public.business_profile FOR ALL
     USING (user_id = (SELECT auth.uid())) 
     WITH CHECK (user_id = (SELECT auth.uid()));
   ```

## Cómo Aplicar la Solución

1. Accede al panel de administración de Supabase.
2. Ve a la sección "SQL Editor".
3. Crea un nuevo script y copia el contenido de `expense-tracker/supabase/migrations/20240610_fix_security_issues.sql`.
4. Ejecuta el script.

## Verificación

El script incluye consultas para verificar que los cambios se hayan aplicado correctamente:

```sql
-- Verificar RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('categorias', 'compras_cuotas', 'business_profile');

-- Verificar políticas
SELECT tablename, policyname, permissive, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename IN ('categorias', 'compras_cuotas', 'business_profile');

-- Verificar configuración de seguridad de la vista
SELECT viewname, CASE WHEN pg_catalog.obj_description(c.oid, 'pg_class') LIKE '%security_invoker%' THEN 'invoker' ELSE 'definer' END AS security
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname = 'vista_cuotas_expandidas';
```

## Consideraciones Adicionales

- **Revisión de políticas**: Es importante revisar que las políticas aplicadas automáticamente se ajusten a tu lógica de negocio.
- **Permisos a nivel de tabla**: Verifica que los permisos (GRANT) otorgados a los roles `anon` y `authenticated` en estas tablas sean apropiados.
- **Recreación de la vista**: Si el comando `ALTER VIEW` no funciona, puede ser necesario recrear la vista con su definición completa incluyendo `WITH (security_invoker = true)`. 