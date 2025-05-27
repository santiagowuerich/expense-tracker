-- Migración: Corregir la llamada a registrar_movimiento_stock en realizar_venta

-- Crear la función registrar_movimiento_stock
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

-- Actualizar la función realizar_venta para usar la firma correcta de registrar_movimiento_stock
CREATE OR REPLACE FUNCTION public.realizar_venta(
  _cliente_data JSONB,
  _items JSONB,
  _pagos JSONB,
  _mensaje_interno TEXT DEFAULT NULL,
  _mensaje_externo TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _cliente_id UUID;
  _venta_id UUID;
  _total_venta DECIMAL(10,2) := 0;
  _total_pagado DECIMAL(10,2) := 0;
  _item JSONB;
  _pago JSONB;
  _producto_id UUID;
  _cantidad INTEGER;
  _precio_unitario DECIMAL(10,2);
  _subtotal DECIMAL(10,2);
  _stock_actual INTEGER;
  _cliente_nombre TEXT;
BEGIN
  -- 1. Insertar o actualizar cliente
  IF (_cliente_data->>'id' IS NOT NULL AND (_cliente_data->>'id')::UUID IS NOT NULL) THEN
    UPDATE public.clientes
    SET
      nombre = COALESCE(_cliente_data->>'nombre', nombre),
      dni_cuit = COALESCE(_cliente_data->>'dni_cuit', dni_cuit),
      direccion = COALESCE(_cliente_data->>'direccion', direccion),
      ciudad = COALESCE(_cliente_data->>'ciudad', ciudad),
      codigo_postal = COALESCE(_cliente_data->>'codigo_postal', codigo_postal),
      telefono = COALESCE(_cliente_data->>'telefono', telefono),
      email = COALESCE(_cliente_data->>'email', email)
    WHERE id = (_cliente_data->>'id')::UUID
    RETURNING id, nombre INTO _cliente_id, _cliente_nombre;
  ELSE
    INSERT INTO public.clientes (nombre, dni_cuit, direccion, ciudad, codigo_postal, telefono, email)
    VALUES (
      (_cliente_data->>'nombre')::TEXT,
      (_cliente_data->>'dni_cuit')::TEXT,
      (_cliente_data->>'direccion')::TEXT,
      (_cliente_data->>'ciudad')::TEXT,
      (_cliente_data->>'codigo_postal')::TEXT,
      (_cliente_data->>'telefono')::TEXT,
      (_cliente_data->>'email')::TEXT
    )
    RETURNING id, nombre INTO _cliente_id, _cliente_nombre;
  END IF;

  -- 2. Crear cabecera de venta con mensajes
  INSERT INTO public.ventas (cliente_id, total, mensaje_interno, mensaje_externo)
  VALUES (_cliente_id, 0, _mensaje_interno, _mensaje_externo)
  RETURNING id INTO _venta_id;

  -- 3. Procesar items, actualizar stock y calcular total_venta
  FOR i IN 0..jsonb_array_length(_items) - 1 LOOP
    _item := _items->i;
    _producto_id := (_item->>'producto_id')::UUID;
    _cantidad := (_item->>'cantidad')::INTEGER;
    _precio_unitario := (_item->>'precio_unitario')::DECIMAL;
    _subtotal := _cantidad * _precio_unitario;

    -- Verificar stock
    SELECT stock INTO _stock_actual FROM public.productos WHERE id = _producto_id FOR UPDATE;
    IF _stock_actual IS NULL THEN RAISE EXCEPTION 'Producto con ID % no encontrado', _producto_id; END IF;
    IF _stock_actual < _cantidad THEN RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %', _producto_id, _stock_actual, _cantidad; END IF;

    -- Insertar item
    INSERT INTO public.ventas_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (_venta_id, _producto_id, _cantidad, _precio_unitario, _subtotal);

    -- Registrar el movimiento de stock con la firma correcta (5 parámetros)
    PERFORM public.registrar_movimiento_stock(
      _producto_id::UUID,              -- UUID: ID del producto
      'VENTA'::TEXT,                   -- TEXT: Tipo de movimiento
      (-_cantidad)::INTEGER,           -- INTEGER: Cantidad (negativa para ventas)
      _venta_id::TEXT,                 -- TEXT: ID de referencia (venta)
      ('Venta a cliente: ' || _cliente_nombre)::TEXT -- TEXT: Notas
    );

    _total_venta := _total_venta + _subtotal;
  END LOOP;

  -- 4. Procesar pagos y calcular total_pagado
  IF jsonb_array_length(_pagos) > 0 THEN
    FOR i IN 0..jsonb_array_length(_pagos) - 1 LOOP
       _pago := _pagos->i;
       INSERT INTO public.ventas_pagos (
         venta_id, 
         metodo_pago, 
         monto,
         cuotas,
         recargo
       )
       VALUES (
          _venta_id,
          (_pago->>'metodo_pago')::TEXT,
          (_pago->>'monto')::DECIMAL,
          NULLIF((_pago->>'cuotas')::INTEGER, 0),
          NULLIF((_pago->>'recargo')::DECIMAL, 0)
       );
       _total_pagado := _total_pagado + (_pago->>'monto')::DECIMAL;
    END LOOP;
  END IF;

  -- 5. Validar que el total pagado sea suficiente para cubrir la venta
  IF _total_pagado < _total_venta THEN
     RAISE EXCEPTION 'El total pagado (%) es insuficiente para cubrir el total de la venta (%). Faltan: %', 
        _total_pagado, _total_venta, abs(_total_venta - _total_pagado);
  END IF;

  -- 6. Actualizar el total real en la cabecera de la venta
  UPDATE public.ventas SET total = _total_pagado WHERE id = _venta_id;

  RETURN _venta_id;
END;
$$;

-- Conceder permisos sobre la función
GRANT EXECUTE ON FUNCTION public.realizar_venta TO authenticated, anon; 