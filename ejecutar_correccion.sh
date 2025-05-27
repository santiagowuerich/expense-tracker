#!/bin/bash

# Script para ejecutar la corrección de la función realizar_venta
# en la base de datos de Supabase

echo "Ejecutando corrección para registrar_movimiento_stock..."

# Ejecutar el archivo SQL usando Supabase CLI
npx supabase db push

# Alternativamente, si Supabase CLI no está disponible, puedes usar psql directamente
# Para ello necesitarías configurar las variables de conexión:
# export PGHOST=db.xxxxxxxxxxxx.supabase.co
# export PGPORT=5432
# export PGDATABASE=postgres
# export PGUSER=postgres
# export PGPASSWORD=your-password
# psql -f "supabase/migrations/027_corregir_registrar_movimiento_stock.sql"

echo "Corrección completada. Por favor verifica que la aplicación funcione correctamente." 