import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { v4 as uuidv4 } from "uuid"

// Función para descontar stock usando lógica LIFO
async function descontarStock(supabase: any, prodId: string, qty: number) {
  let pendiente = qty

  while (pendiente > 0) {
    const { data: compra, error } = await supabase
      .from("compras")
      .select("*")
      .eq("producto_id", prodId)
      .gt("restante", 0)
      .order("created_at", { ascending: false }) // LIFO
      .order("costo_unit", { ascending: false }) // tie-break
      .limit(1)
      .single()

    if (error || !compra) {
      throw new Error("Stock insuficiente")
    }

    const usar = Math.min(pendiente, compra.restante)

    const { error: updateError } = await supabase
      .from("compras")
      .update({ restante: compra.restante - usar })
      .eq("id", compra.id)

    if (updateError) {
      throw new Error("Error al actualizar el stock")
    }

    pendiente -= usar
  }

  // Sincronizar el stock del producto
  await supabase.rpc("update_stock_producto", { _prod_id: prodId })
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const data = await request.json()

    const {
      payment_method,
      tarjeta_id,
      monto,
      fecha,
      descripcion,
      producto_id,
      cantidad,
      en_cuotas,
      cuotas,
      payment_intent_id,
      tipo_transaccion,
    } = data

    // Validar datos básicos
    if (!payment_method || !monto || !fecha) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    // Validar método de pago
    if (!["tarjeta", "efectivo", "transferencia"].includes(payment_method)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 })
    }

    // Validar tarjeta_id si el método es tarjeta
    if (payment_method === "tarjeta" && !tarjeta_id) {
      return NextResponse.json({ error: "Se requiere una tarjeta para pagos con tarjeta" }, { status: 400 })
    }

    // Validar tipo de transaccion
    if (!['gasto', 'ingreso'].includes(tipo_transaccion)) {
      return NextResponse.json({ error: "Tipo de transacción inválido" }, { status: 400 })
    }

    let compraIdRegistrada: string | null = null; // Declarar fuera del if

    // Manejo del stock según el tipo de transacción
    if (producto_id && cantidad > 0) {
      if (tipo_transaccion === 'gasto') {
        // --- Lógica para GASTO con PRODUCTO_ID (Compra de Inventario) ---

        // 1. Incrementar Stock en la tabla 'productos'
        const { data: productoActual, error: productoError } = await supabase
          .from('productos')
          .select('stock')
          .eq('id', producto_id)
          .single();

        if (productoError) {
          return NextResponse.json({ error: 'Error al obtener el producto para actualizar stock' }, { status: 500 });
        }

        if (!productoActual) {
          // Si el producto no existe, ¿debería crearse o fallar? Por ahora falla.
          return NextResponse.json({ error: 'Producto no encontrado para actualizar stock' }, { status: 404 });
        }

        const stockActual = productoActual.stock || 0;
        const nuevoStock = stockActual + cantidad;

        const { error: updateError } = await supabase
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', producto_id);

        if (updateError) {
          // Si falla la actualización de stock, podríamos querer revertir o loggear, pero continuar para registrar el pago
          console.error("Error al actualizar stock en compra:", updateError);
          // Considerar si devolver un error aquí o solo loggear
        }

        // 2. Registrar en la tabla 'compras' (Lógica añadida previamente, se mantiene)
        const costoUnitarioCompra = monto / cantidad;
        const { data: compraData, error: compraError } = await supabase
          .from('compras')
          .insert({
            producto_id: producto_id,
            costo_unit: costoUnitarioCompra,
            cantidad: cantidad,
            restante: cantidad, // Inicialmente, la cantidad restante es la cantidad comprada
          })
          .select('id')
          .single();

        if (compraError) {
          console.error("Error al registrar la compra en tabla 'compras':", compraError);
          // No detener la transacción principal por esto, pero loggear
        }
        // (Opcional: registrar historial de precios si es necesario)

        // Registrar en historial de precios si la compra se registró correctamente
        if (compraData) {
          const { error: historyError } = await supabase
            .from("price_history")
            .insert({
              producto_id: producto_id,
              tipo: "costo", // Indicar que es un precio de costo
              precio: costoUnitarioCompra,
              compra_id: compraData.id, // Vincular al registro de compra
            });

          if (historyError) {
            console.error("Error al registrar historial de precios:", historyError);
            // No detener la transacción principal, pero loggear el error
          }
        }

        // Asignar el ID si la inserción fue exitosa
        compraIdRegistrada = compraData ? compraData.id : null;

      } else if (tipo_transaccion === 'ingreso') {
        // --- Lógica para INGRESO con PRODUCTO_ID (Ajuste manual de stock, NO compra) ---
        // Esta lógica podría necesitar revisión. ¿Realmente hay un caso de uso para "ingreso" con producto aquí?
        // Si esto fuera un ajuste manual, probablemente no involucraría un pago.
        // Por ahora, se mantiene la lógica original de solo incrementar stock.

        // Obtener el producto actual para calcular el nuevo stock
        const { data: productoActual, error: productoError } = await supabase
          .from('productos')
          .select('stock')
          .eq('id', producto_id)
          .single();

        if (productoError) {
          return NextResponse.json({ error: 'Error al obtener el producto para actualizar stock' }, { status: 500 });
        }

        if (!productoActual) {
          return NextResponse.json({ error: 'Producto no encontrado para actualizar stock' }, { status: 404 });
        }

        const stockActual = productoActual.stock || 0;
        const nuevoStock = stockActual + cantidad;

        // Agregar stock directamente a la tabla de productos
        const { error: updateError } = await supabase
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', producto_id);

        if (updateError) {
          return NextResponse.json({ error: 'Error al agregar stock' }, { status: 500 });
        }
      }
    }
    
    // Calcular ciclo de cierre si es tarjeta
    let ciclo_cierre = null
    if (payment_method === "tarjeta") {
      // Obtener información de la tarjeta para calcular el ciclo de cierre
      const { data: tarjeta, error: tarjetaError } = await supabase
        .from("tarjetas")
        .select("cierre_dia")
        .eq("id", tarjeta_id)
        .single()

      if (tarjetaError) {
        return NextResponse.json({ error: "Error al obtener información de la tarjeta" }, { status: 500 })
      }

      // Calcular el ciclo de cierre correctamente
      const fechaGasto = new Date(fecha)
      const corteActual = new Date(fechaGasto.getFullYear(), fechaGasto.getMonth(), tarjeta.cierre_dia)

      // Si la fecha del gasto es posterior al cierre actual, el ciclo es el del mes siguiente
      ciclo_cierre =
        fechaGasto > corteActual
          ? new Date(corteActual.getFullYear(), corteActual.getMonth() + 1, corteActual.getDate())
          : corteActual
    }

    // Determinar si es un pago único o en cuotas
    const esEnCuotas = payment_method === "tarjeta" && en_cuotas && cuotas > 1

    // Datos base para todos los pagos
    const pagoBase = {
      tarjeta_id: payment_method === "tarjeta" ? tarjeta_id : null,
      fecha,
      producto_id: producto_id || null,
      payment_intent_id,
      payment_method,
      // compra_id se añadirá específicamente si viene de una compra
    }

    if (!esEnCuotas) {
      // Guardar como pago único
      const { error: pagoError } = await supabase.from("pagos").insert({
        ...pagoBase,
        monto,
        descripcion,
        ciclo_cierre: ciclo_cierre ? ciclo_cierre.toISOString() : null,
        cuotas: 1,
        cuota_actual: 1,
        es_cuota: false,
        compra_id: compraIdRegistrada
      })

      if (pagoError) {
        return NextResponse.json({ error: pagoError.message }, { status: 500 })
      }
    } else {
      // Solo guardar las cuotas individuales para evitar doble conteo
      const montoPorCuota = Number((monto / cuotas).toFixed(2))
      const cuotasArray = Array.from({ length: cuotas }, (_, i) => i + 1)

      // Crear un array de objetos para inserción masiva
      const cuotasInsert = cuotasArray.map((numeroCuota) => {
        // Calcular la fecha de cierre para esta cuota
        const fechaCuota = new Date(ciclo_cierre as Date)
        fechaCuota.setMonth(ciclo_cierre!.getMonth() + numeroCuota - 1)

        return {
          ...pagoBase,
          monto: montoPorCuota,
          descripcion: `${descripcion} (Cuota ${numeroCuota}/${cuotas})`,
          ciclo_cierre: fechaCuota.toISOString(),
          cuotas,
          cuota_actual: numeroCuota,
          es_cuota: true,
          pago_original_id: null,
          payment_intent_id: `${payment_intent_id}-cuota-${numeroCuota}`,
          compra_id: compraIdRegistrada
        }
      })

      // Insertar todas las cuotas en una sola operación
      const { error: cuotasError } = await supabase.from("pagos").insert(cuotasInsert)

      if (cuotasError) {
        return NextResponse.json({ error: cuotasError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error al procesar la transacción:", error)
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 })
  }
}
