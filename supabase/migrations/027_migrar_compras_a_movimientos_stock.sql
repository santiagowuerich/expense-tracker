-- Script para migrar datos de compras existentes a la tabla public.movimientos_stock
-- Este script toma las compras registradas y genera registros equivalentes en la tabla de movimientos de stock

DO $$
DECLARE
    compra_record RECORD;
    stock_antes INTEGER;
    stock_despues INTEGER;
    usuario_id UUID;
BEGIN
    -- Primero, verificamos si ya hay un movimiento de tipo 'ENTRADA_COMPRA_MIGRADA' en movimientos_stock para evitar duplicados
    CREATE TEMP TABLE IF NOT EXISTS compras_ya_migradas AS
    SELECT referencia_id::UUID AS compra_id
    FROM public.movimientos_stock
    WHERE tipo_movimiento = 'ENTRADA_COMPRA_MIGRADA';

    -- Obtenemos el ID del usuario actual para los registros que necesiten un creado_por
    SELECT auth.uid() INTO usuario_id;
    
    -- Iteramos sobre las compras existentes que no estén ya migradas
    FOR compra_record IN 
        SELECT 
            c.id, 
            c.producto_id, 
            c.cantidad, 
            c.costo_unit,
            c.created_at,
            p.stock AS stock_actual
        FROM 
            public.compras c
        JOIN 
            public.productos p ON c.producto_id = p.id
        LEFT JOIN 
            compras_ya_migradas m ON c.id = m.compra_id
        WHERE 
            m.compra_id IS NULL  -- Solamente aquellas que no están ya migradas
    LOOP
        -- Para calcular stock_anterior y stock_nuevo, podemos usar una aproximación simple:
        -- El stock actual menos la cantidad de la compra es una estimación del stock anterior
        -- Esto no será históricamente preciso pero funciona para visualización
        stock_despues := compra_record.stock_actual;
        stock_antes := stock_despues - compra_record.cantidad;
        
        -- Insertar el movimiento de stock
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
            compra_record.producto_id,
            'ENTRADA_COMPRA_MIGRADA',
            compra_record.cantidad,  -- Cantidad positiva para entradas
            stock_antes,             -- Estimación simplificada
            stock_despues,           -- Stock actual
            compra_record.id::TEXT,  -- ID de la compra como referencia
            'Entrada por Compra (Migrado) #' || compra_record.id::TEXT || ' - Costo: $' || compra_record.costo_unit,
            compra_record.created_at,  -- Fecha original de la compra
            compra_record.created_at,  -- Fecha de creación original
            usuario_id                 -- Usuario actual que realiza la migración
        );
        
        RAISE NOTICE 'Migrado: Compra ID %, Producto ID %, Cantidad %', 
            compra_record.id, compra_record.producto_id, compra_record.cantidad;
    END LOOP;

    -- Limpiar tabla temporal
    DROP TABLE IF EXISTS compras_ya_migradas;
    
    RAISE NOTICE 'Migración completada.';
END;
$$;

-- Verificación: Contar los movimientos de stock insertados
SELECT COUNT(*) AS movimientos_migrados 
FROM public.movimientos_stock 
WHERE tipo_movimiento = 'ENTRADA_COMPRA_MIGRADA'; 