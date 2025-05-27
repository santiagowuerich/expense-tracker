-- Función para registrar movimientos de stock
-- Esta función permite registrar cualquier movimiento de stock y actualizar el stock del producto

CREATE OR REPLACE FUNCTION public.registrar_movimiento_stock(
    p_producto_id UUID,                      -- ID del producto
    p_tipo_movimiento TEXT,                  -- Tipo de movimiento (ENTRADA_COMPRA, VENTA, AJUSTE_MANUAL, etc.)
    p_cantidad_movimiento INTEGER,           -- Cantidad (positiva para entradas, negativa para salidas)
    p_referencia_id TEXT DEFAULT NULL,       -- ID de referencia opcional (ID de compra, venta, etc.)
    p_notas TEXT DEFAULT NULL                -- Notas explicativas opcionales
)
RETURNS TABLE (
    movimiento_id UUID,                      -- ID del movimiento creado
    mensaje TEXT,                            -- Mensaje informativo
    stock_anterior INTEGER,                  -- Stock antes del movimiento
    stock_nuevo INTEGER,                     -- Stock después del movimiento
    nuevo_stock_calculado INTEGER            -- Stock actualizado en la tabla productos
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _producto_record RECORD;
    _stock_anterior INTEGER;
    _stock_nuevo INTEGER;
    _movimiento_id UUID;
    _mensaje TEXT;
BEGIN
    -- Verificar que el producto existe y obtener su stock actual (bloqueando para actualización)
    SELECT id, nombre, stock INTO _producto_record
    FROM public.productos
    WHERE id = p_producto_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            'Error: Producto no encontrado'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::INTEGER;
        RETURN;
    END IF;

    -- Guardar el stock anterior
    _stock_anterior := _producto_record.stock;
    
    -- Calcular el nuevo stock
    _stock_nuevo := _stock_anterior + p_cantidad_movimiento;
    
    -- Verificar si el stock quedaría negativo (solo para salidas)
    IF _stock_nuevo < 0 AND p_cantidad_movimiento < 0 THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            'Error: Stock insuficiente. Stock actual: ' || _stock_anterior::TEXT || ', Cantidad solicitada: ' || ABS(p_cantidad_movimiento)::TEXT,
            _stock_anterior,
            NULL::INTEGER,
            _stock_anterior;
        RETURN;
    END IF;
    
    -- Actualizar el stock en la tabla productos
    UPDATE public.productos
    SET stock = _stock_nuevo
    WHERE id = p_producto_id;
    
    -- Registrar el movimiento en movimientos_stock
    INSERT INTO public.movimientos_stock (
        producto_id,
        tipo_movimiento,
        cantidad,
        stock_anterior,
        stock_nuevo,
        referencia_id,
        notas,
        fecha,
        creado_en,
        creado_por
    )
    VALUES (
        p_producto_id,
        p_tipo_movimiento,
        p_cantidad_movimiento,
        _stock_anterior,
        _stock_nuevo,
        p_referencia_id,
        p_notas,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        auth.uid()
    )
    RETURNING id INTO _movimiento_id;
    
    -- Preparar mensaje
    _mensaje := 'Movimiento registrado exitosamente. Producto: ' || _producto_record.nombre || 
                ', Nuevo stock: ' || _stock_nuevo::TEXT;
    
    -- Retornar información del movimiento
    RETURN QUERY SELECT 
        _movimiento_id,
        _mensaje,
        _stock_anterior,
        _stock_nuevo,
        _stock_nuevo;
END;
$$;

-- Otorgar permisos de ejecución a los usuarios autenticados
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_stock(UUID, TEXT, INTEGER, TEXT, TEXT) TO authenticated;

-- Comentarios sobre la función
COMMENT ON FUNCTION public.registrar_movimiento_stock IS 
'Registra un movimiento de stock y actualiza el stock del producto.
- Para entradas: Cantidad positiva
- Para salidas: Cantidad negativa
La función verifica el stock suficiente para salidas y actualiza automáticamente la tabla productos.'; 