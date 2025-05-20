# Optimizaciones para la aplicación

Este documento describe las soluciones implementadas para resolver los problemas identificados en la aplicación:

## 1. Solución para los problemas de cookies de autenticación

### Problema identificado
Se detectaron errores en múltiples Route Handlers con mensajes como:
- "Error: Route used `cookies().get('sb-auth-token')`. `cookies()` should be awaited before using its value."
- "Cannot read properties of undefined (reading 'get')" en la ruta `/api/payment-by-purchase`.

### Solución implementada
1. Se modificó `lib/supabase-server.ts` para hacer `createClient()` asíncrona y utilizar `await cookies()`.
2. Se actualizaron todas las rutas de API para usar:
   ```typescript
   const cookieStore = await cookies();
   const supabase = await createClient(cookieStore);
   ```

3. Archivos actualizados:
   - expense-tracker/app/api/product-purchases/route.ts
   - expense-tracker/app/api/add-purchase/route.ts
   - Todas las demás rutas de API ya utilizaban la implementación asíncrona

### Cómo verificar la solución
1. Ejecuta la aplicación y verifica que las rutas de API ya no muestren los errores mencionados.
2. Asegúrate de que las operaciones de autenticación funcionen correctamente.

## 2. Optimización de políticas RLS en Supabase

### Problemas identificados
1. **Problema `auth_rls_initplan`**: Las políticas que utilizan `auth.uid()` directamente causan una evaluación ineficiente fila por fila.
2. **Problema `multiple_permissive_policies`**: Existen tablas con múltiples políticas permisivas para el mismo rol y acción.

### Solución implementada
Se creó un archivo de migración (`20240610_optimize_rls_policies.sql`) que:

1. Optimiza políticas con `auth.uid()` directo:
   - Reemplaza `auth.uid() = user_id` por `user_id = (SELECT auth.uid())`, que permite a PostgreSQL utilizar índices.
   - Actualiza las políticas en las tablas: productos, clientes, ventas, ventas_items y ventas_pagos.

2. Para las múltiples políticas permisivas:
   - Se incluye un script comentado para identificar políticas permisivas duplicadas.
   - Se proporciona un ejemplo de implementación de función para consolidar políticas.

### Cómo aplicar la migración
1. Accede al panel de administración de Supabase.
2. Ve a la sección "SQL Editor".
3. Crea un nuevo script y copia el contenido de `expense-tracker/supabase/migrations/20240610_optimize_rls_policies.sql`.
4. Ejecuta el script.
5. Verifica que las advertencias del linter de Supabase hayan desaparecido.

### Consideraciones adicionales
Para una optimización más profunda de las políticas permisivas múltiples, se recomienda:
1. Ejecutar la consulta SQL comentada en el script para identificar todas las políticas.
2. Analizar cada conjunto de políticas permisivas y determinar si pueden consolidarse.
3. Implementar funciones específicas para cada caso de uso.

## Resumen
Estas optimizaciones mejorarán:
1. La estabilidad de las rutas de API relacionadas con la autenticación.
2. El rendimiento de las consultas a Supabase que utilizan políticas RLS.
3. La eficiencia general de la base de datos al reducir la carga de trabajo en el motor de PostgreSQL. 