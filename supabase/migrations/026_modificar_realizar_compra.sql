-- Script para modificar o crear la función realizar_compra 
-- para que registre automáticamente movimientos de stock

-- Eliminar la función si existe (para poder recrearla con los nuevos parámetros)
DROP FUNCTION IF EXISTS public.realizar_compra(UUID, NUMERIC, INTEGER);

-- Crear o reemplazar la función realizar_compra para incluir registro en movimientos_stock
CREATE OR REPLACE FUNCTION public.realizar_compra(
    p_producto_id UUID,   -- ID del producto
    p_costo_unit NUMERIC, -- Costo unitario
    p_cantidad INTEGER    -- Cantidad comprada
)
RETURNS TABLE (
    compra_id UUID,       -- ID de la compra realizada
    mensaje TEXT,         -- Mensaje informativo
    nuevo_stock INTEGER   -- Nuevo stock del producto
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _producto_record RECORD;
    _compra_id UUID;
    _stock_anterior INTEGER;
    _stock_nuevo INTEGER;
    _mensaje TEXT;
BEGIN
    -- Verificar que el producto existe y obtener datos actuales
    SELECT id, nombre, stock INTO _producto_record
    FROM public.productos
    WHERE id = p_producto_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            'Error: Producto no encontrado'::TEXT,
            NULL::INTEGER;
        RETURN;
    END IF;
    
    -- Guardar stock anterior para referencias
    _stock_anterior := _producto_record.stock;
    
    -- Registrar la compra en la tabla compras
    INSERT INTO public.compras (
        producto_id,
        costo_unit,
        cantidad,
        restante
    )
    VALUES (
        p_producto_id,
        p_costo_unit,
        p_cantidad,
        p_cantidad -- Inicialmente, restante = cantidad
    )
    RETURNING id INTO _compra_id;
    
    -- Actualizar el stock en la tabla productos
    _stock_nuevo := _stock_anterior + p_cantidad;
    UPDATE public.productos
    SET stock = _stock_nuevo
    WHERE id = p_producto_id;
    
    -- Registrar el movimiento en movimientos_stock usando la función existente
    PERFORM registrar_movimiento_stock(
        p_producto_id,
        'ENTRADA_COMPRA',
        p_cantidad,
        _compra_id::TEXT,
        'Entrada por Compra #' || _compra_id::TEXT || ' - Costo: $' || p_costo_unit::TEXT
    );
    
    -- Preparar mensaje
    _mensaje := 'Compra registrada exitosamente. Producto: ' || _producto_record.nombre || 
                ', Cantidad: ' || p_cantidad::TEXT || ', Nuevo stock: ' || _stock_nuevo::TEXT;
    
    -- Retornar información de la compra
    RETURN QUERY SELECT 
        _compra_id,
        _mensaje,
        _stock_nuevo;
END;
$$;

-- Otorgar permisos de ejecución a los usuarios autenticados
GRANT EXECUTE ON FUNCTION public.realizar_compra(UUID, NUMERIC, INTEGER) TO authenticated;

-- Comentarios sobre la función
COMMENT ON FUNCTION public.realizar_compra IS 
'Registra una compra de producto, actualiza el stock y registra el movimiento correspondiente.
- La función verifica que el producto exista
- Actualiza automáticamente el stock en la tabla productos
- Registra el movimiento en la tabla movimientos_stock'; 