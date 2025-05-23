-- Modificación de la función realizar_venta para manejar recargos de tarjeta correctamente

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
    RETURNING id INTO _cliente_id;
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
    RETURNING id INTO _cliente_id;
  END IF;

  -- 2. Crear cabecera de venta (total se actualizará después)
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

    -- Actualizar stock en tabla productos
    UPDATE public.productos SET stock = stock - _cantidad WHERE id = _producto_id;

    _total_venta := _total_venta + _subtotal;
  END LOOP;

  -- 4. Procesar pagos y calcular total_pagado
  IF jsonb_array_length(_pagos) > 0 THEN -- Solo procesar si hay pagos
    FOR i IN 0..jsonb_array_length(_pagos) - 1 LOOP
       _pago := _pagos->i;
       INSERT INTO public.ventas_pagos (venta_id, metodo_pago, monto)
       VALUES (
          _venta_id,
          (_pago->>'metodo_pago')::TEXT,
          (_pago->>'monto')::DECIMAL
       );
       _total_pagado := _total_pagado + (_pago->>'monto')::DECIMAL;
    END LOOP;
  END IF;

  -- 5. SOLUCIÓN AL PROBLEMA: En lugar de validar exactamente, permitimos que el total pagado sea mayor
  -- Esto permite pagos con recargo (tarjeta de crédito). Solo validamos que se pague al menos el valor
  -- de los productos.
  IF _total_pagado < _total_venta THEN
     RAISE EXCEPTION 'El total pagado (%) es insuficiente para cubrir el total de la venta (%). Faltan: %', 
        _total_pagado, _total_venta, abs(_total_venta - _total_pagado);
  END IF;

  -- 6. Actualizar el total real en la cabecera de la venta - AHORA GUARDAMOS EL TOTAL PAGADO
  -- Este cambio es importante: guardamos lo que realmente se pagó, incluyendo recargos
  UPDATE public.ventas SET total = _total_pagado WHERE id = _venta_id;

  RETURN _venta_id;
END;
$$; 