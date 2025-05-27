-- Buscar en realizar_venta dónde se llama a registrar_movimiento_stock y corregir
-- La función registrar_movimiento_stock espera 5 parámetros, pero se están pasando 6

-- 1. Consultar la definición actual de realizar_venta para identificar el problema
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'realizar_venta';

-- 2. Corregir la función para usar la firma correcta de registrar_movimiento_stock
-- Esto debe hacerse en Supabase, abriendo el panel de SQL y ejecutando:

/*
Este es el código correcto para llamar a registrar_movimiento_stock:

SELECT * FROM registrar_movimiento_stock(
    _item_registro.producto_id,           -- UUID: ID del producto
    'VENTA',                              -- TEXT: Tipo de movimiento
    -_item_registro.cantidad,             -- INTEGER: Cantidad (negativa para ventas)
    _venta_id::TEXT,                      -- TEXT: ID de referencia (venta)
    'Venta a cliente: ' || _cliente_nombre -- TEXT: Notas
);

NO debe incluir un sexto parámetro UUID.
*/ 