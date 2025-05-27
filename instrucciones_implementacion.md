# Instrucciones de Implementación

## Estructura del Proyecto

Hemos creado tres archivos SQL para implementar la integración entre compras y movimientos de stock:

1. **migrar_compras_a_movimientos_stock.sql**: Script para migrar datos históricos de compras a la tabla movimientos_stock
2. **registrar_movimiento_stock.sql**: Función que registra cualquier movimiento de stock
3. **modificar_realizar_compra.sql**: Modificación de la función realizar_compra para que registre movimientos automáticamente

## Orden de Implementación

Para implementar correctamente estos cambios, sigue estos pasos en orden:

1. Verifica si la tabla `movimientos_stock` existe y tiene la estructura esperada.
   Si no existe, primero debes crearla (ver abajo).

2. Ejecuta **registrar_movimiento_stock.sql** para crear la función base.

3. Ejecuta **migrar_compras_a_movimientos_stock.sql** para migrar los datos históricos.

4. Finalmente, ejecuta **modificar_realizar_compra.sql** para modificar el comportamiento futuro.

## Verificación

Después de cada paso, verifica que todo funcione correctamente:

1. Confirma que los datos migraron correctamente consultando la tabla `movimientos_stock`.
2. Prueba la función `registrar_movimiento_stock` con datos de prueba.
3. Prueba la función `realizar_compra` para verificar que registra automáticamente los movimientos.

## Creación de la tabla movimientos_stock (Si no existe)

Si la tabla `movimientos_stock` no existe, puedes crearla con este script:

```sql
CREATE TABLE IF NOT EXISTS public.movimientos_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo_movimiento TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    stock_anterior INTEGER,
    stock_nuevo INTEGER,
    referencia_id TEXT,
    notas TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_producto_id ON public.movimientos_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_fecha ON public.movimientos_stock(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_tipo ON public.movimientos_stock(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_referencia ON public.movimientos_stock(referencia_id);

-- Habilitar RLS
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.movimientos_stock FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserción a usuarios autenticados que son dueños del producto" 
ON public.movimientos_stock FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.productos p 
        WHERE p.id = producto_id AND p.user_id = auth.uid()
    )
);

-- Conceder permisos
GRANT SELECT, INSERT ON public.movimientos_stock TO authenticated;
```

## Observaciones

1. Los scripts están diseñados para adaptarse a la estructura que observamos en tu base de datos.
2. En la migración de datos históricos, usamos una aproximación simplificada para `stock_anterior` y `stock_nuevo`.
3. La función `registrar_movimiento_stock` incluye validaciones para evitar stock negativo.
4. Hemos incluido referencias al ID de la compra original para mantener la trazabilidad.

## Soporte para Debugging

Si encuentras errores, puedes revisar:

1. Los mensajes de RAISE NOTICE en el script de migración.
2. El recuento final de registros migrados.
3. Los mensajes devueltos por las funciones cuando las ejecutas.

## Personalización

Estos scripts representan una implementación base. Puedes personalizarlos según tus necesidades específicas:

1. Ajustar los tipos de movimiento según tus convenciones.
2. Cambiar cómo se calculan los valores de stock en la migración.
3. Modificar los mensajes o la lógica de validación. 