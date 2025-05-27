# Corrección de error en `registrar_movimiento_stock`

## Problema detectado

Se identificaron los siguientes errores:

```
Error: Error detallado de RPC: "{\n  \"code\": \"42883\",\n  \"details\": null,\n  \"hint\": \"No function matches the given name and argument types. You might need to add explicit type casts.\",\n  \"message\": \"function public.registrar_movimiento_stock(uuid, unknown, integer, text, text, uuid) does not exist\"\n}"
```

Después de la primera corrección, seguimos teniendo un error similar:

```
Error: Error detallado de RPC: "{\n  \"code\": \"42883\",\n  \"details\": null,\n  \"hint\": \"No function matches the given name and argument types. You might need to add explicit type casts.\",\n  \"message\": \"function registrar_movimiento_stock(uuid, unknown, integer, text, text) does not exist\"\n}"
```

El problema principal es que la función `registrar_movimiento_stock` no existe o no está accesible correctamente desde la función `realizar_venta`.

## Solución implementada

Hemos creado dos archivos SQL importantes:

1. `supabase/migrations/025_registrar_movimiento_stock.sql` - Define la función `registrar_movimiento_stock` 
2. `supabase/migrations/027_corregir_registrar_movimiento_stock.sql` - Actualiza la función `realizar_venta` para usar correctamente la función anterior

Esta solución integral asegura que:
1. La función `registrar_movimiento_stock` existe y está bien definida
2. La función `realizar_venta` llama correctamente a `registrar_movimiento_stock`
3. Los permisos están correctamente configurados

## Cómo aplicar la corrección

Debido a que el comando `supabase db push` requiere enlazar el proyecto, debes ejecutar manualmente los SQL desde la consola de Supabase:

1. Abre la consola SQL de tu proyecto en Supabase
2. Ejecuta primero el contenido del archivo `supabase/migrations/025_registrar_movimiento_stock.sql`
3. Luego ejecuta el contenido del archivo `supabase/migrations/027_corregir_registrar_movimiento_stock.sql`

### Orden de ejecución importante

Es crucial ejecutar los archivos en este orden:
1. Primero `025_registrar_movimiento_stock.sql` para crear la función
2. Después `027_corregir_registrar_movimiento_stock.sql` para actualizar `realizar_venta`

## Verificación

Después de aplicar la corrección:
1. Intenta realizar una venta para verificar que el problema ha sido resuelto
2. Verifica que los movimientos de stock se registren correctamente en la tabla `movimientos_stock` 