-- Migración: Agregar sistema de ventas

-- Asegurar que tenemos la extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  dni_cuit TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  codigo_postal TEXT,
  telefono TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS public.ventas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id),
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total DECIMAL(10,2) NOT NULL,
  monto_original DECIMAL(10,2),
  metodo_pago TEXT,
  numero_cuotas INTEGER,
  porcentaje_recargo DECIMAL(10,4),
  monto_recargo DECIMAL(10,2),
  monto_total_con_recargo DECIMAL(10,2),
  monto_por_cuota DECIMAL(10,2),
  estado_pago TEXT DEFAULT 'PENDIENTE',
  mensaje_interno TEXT,
  mensaje_externo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de items de venta
CREATE TABLE IF NOT EXISTS public.ventas_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad INTEGER NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nueva tabla para registrar los pagos asociados a una venta
CREATE TABLE IF NOT EXISTS public.ventas_pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metodo_pago TEXT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  cuotas INTEGER,
  recargo DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HABILITAR RLS y definir políticas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar sus propios clientes" ON public.clientes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar sus propias ventas" ON public.ventas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.ventas_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar sus propios items de venta" ON public.ventas_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.ventas_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar sus propios pagos de venta" ON public.ventas_pagos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Modificar Función para realizar una venta atomicamente (añadir manejo de pagos)
CREATE OR REPLACE FUNCTION realizar_venta(
  _cliente_data JSONB,
  _items JSONB,
  _pagos JSONB -- Nuevo parámetro para los detalles de pago
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
  -- 1. Insertar o actualizar cliente (sin cambios)
  IF (_cliente_data->>'id' IS NOT NULL AND (_cliente_data->>'id')::UUID IS NOT NULL) THEN
    UPDATE clientes
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
    INSERT INTO clientes (nombre, dni_cuit, direccion, ciudad, codigo_postal, telefono, email)
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
  INSERT INTO ventas (cliente_id, total)
  VALUES (_cliente_id, 0)
  RETURNING id INTO _venta_id;

  -- 3. Procesar items, actualizar stock y calcular total_venta
  FOR i IN 0..jsonb_array_length(_items) - 1 LOOP
    _item := _items->i;
    _producto_id := (_item->>'producto_id')::UUID;
    _cantidad := (_item->>'cantidad')::INTEGER;
    _precio_unitario := (_item->>'precio_unitario')::DECIMAL;
    _subtotal := _cantidad * _precio_unitario;

    -- Verificar stock
    SELECT stock INTO _stock_actual FROM productos WHERE id = _producto_id FOR UPDATE; -- Bloquear fila para actualizar stock
    IF _stock_actual IS NULL THEN RAISE EXCEPTION 'Producto con ID % no encontrado', _producto_id; END IF;
    IF _stock_actual < _cantidad THEN RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %', _producto_id, _stock_actual, _cantidad; END IF;

    -- Insertar item
    INSERT INTO ventas_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    VALUES (_venta_id, _producto_id, _cantidad, _precio_unitario, _subtotal);

    -- Actualizar stock
    UPDATE productos SET stock = stock - _cantidad WHERE id = _producto_id;

    -- Acumular total_venta
    _total_venta := _total_venta + _subtotal;
  END LOOP;

  -- 4. Procesar pagos y calcular total_pagado
  FOR i IN 0..jsonb_array_length(_pagos) - 1 LOOP
     _pago := _pagos->i;
     INSERT INTO ventas_pagos (venta_id, metodo_pago, monto)
     VALUES (
        _venta_id,
        (_pago->>'metodo_pago')::TEXT,
        (_pago->>'monto')::DECIMAL
     );
     _total_pagado := _total_pagado + (_pago->>'monto')::DECIMAL;
  END LOOP;

  -- 5. Validar que el total pagado coincida con el total de la venta
  -- Permitir una pequeña diferencia por errores de redondeo decimal
  IF abs(_total_venta - _total_pagado) > 0.01 THEN
     RAISE EXCEPTION 'El total pagado (%) no coincide con el total de la venta (%). Diferencia: %', 
        _total_pagado, _total_venta, abs(_total_venta - _total_pagado);
  END IF;

  -- 6. Actualizar el total real en la cabecera de la venta
  UPDATE ventas SET total = _total_venta WHERE id = _venta_id;

  RETURN _venta_id;
END;
$$;

-- Actualizar la función update_stock_producto
CREATE OR REPLACE FUNCTION update_stock_producto(_prod_id UUID)
RETURNS VOID AS $$
DECLARE
  _suma INTEGER;
BEGIN
  -- Calcular la suma de cantidad restante en la tabla compras
  SELECT COALESCE(SUM(restante), 0) INTO _suma
  FROM compras
  WHERE producto_id = _prod_id;
  
  -- Actualizar el stock en la tabla productos
  UPDATE productos
  SET stock = _suma
  WHERE id = _prod_id;
END;
$$ LANGUAGE plpgsql; 