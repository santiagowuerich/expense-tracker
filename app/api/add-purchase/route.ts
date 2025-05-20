import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { v4 as uuidv4 } from "uuid"
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    // Uso asíncrono de cookies()
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const body = await request.json()

    // Validación básica
    if (!body.producto_id || !body.cantidad || !body.costo_unit || !body.tarjeta_id) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    // 1. Insertar en compras
    const compraId = body.id || uuidv4()
    const { data: compra, error: errCompra } = await supabase
      .from("compras")
      .insert({
        id: compraId,
        producto_id: body.producto_id,
        costo_unit: body.costo_unit,
        cantidad: body.cantidad,
        restante: body.cantidad,
        created_at: body.fecha || new Date().toISOString(),
      })
      .select()

    if (errCompra) {
      console.error("Error al registrar compra:", errCompra)
      return NextResponse.json({ error: errCompra.message }, { status: 400 })
    }

    // 2. Actualizar stock sumando cantidad
    const { error: errStock } = await supabase.rpc("update_stock_producto", { _prod_id: body.producto_id })

    if (errStock) {
      console.error("Error al actualizar stock:", errStock)
      return NextResponse.json({ error: errStock.message }, { status: 400 })
    }

    // 3. Registrar en historial de precios si existe la tabla
    try {
      const { error: historyError } = await supabase.from("price_history").insert({
        producto_id: body.producto_id,
        tipo: "costo",
        precio: body.costo_unit,
        compra_id: compraId,
      })

      if (historyError && !historyError.message.includes("does not exist")) {
        console.error("Error al registrar historial de precios:", historyError)
      }
    } catch (error) {
      console.error("Error al verificar historial de precios:", error)
    }

    // 4. Registrar pago si es necesario
    if (body.tarjeta_id) {
      // Generar un ID único para el pago (para idempotencia)
      const paymentIntentId = uuidv4()

      // Obtener información de la tarjeta para calcular el ciclo de cierre
      const { data: tarjeta, error: tarjetaError } = await supabase
        .from("tarjetas")
        .select("cierre_dia")
        .eq("id", body.tarjeta_id)
        .single()

      if (tarjetaError) {
        console.error("Error al obtener información de tarjeta:", tarjetaError)
        // Continuamos aunque haya error, ya que el registro de compra ya se realizó
      } else {
        // Calcular el ciclo de cierre correctamente
        const fechaGasto = new Date(body.fecha || new Date())
        const corteActual = new Date(fechaGasto.getFullYear(), fechaGasto.getMonth(), tarjeta.cierre_dia)

        // Si la fecha del gasto es posterior al cierre actual, el ciclo es el del mes siguiente
        const ciclo_cierre =
          fechaGasto > corteActual
            ? new Date(corteActual.getFullYear(), corteActual.getMonth() + 1, corteActual.getDate())
            : corteActual

        // Determinar si es un pago único o en cuotas
        const esEnCuotas = body.en_cuotas && body.cuotas > 1

        // Datos base para todos los pagos
        const pagoBase = {
          tarjeta_id: body.tarjeta_id,
          fecha: fechaGasto.toISOString(),
          producto_id: body.producto_id,
          payment_intent_id: paymentIntentId,
          compra_id: compraId, // Asociar el pago con la compra
        }

        // Monto total de la compra
        const montoTotal = body.monto_total || body.cantidad * body.costo_unit

        if (!esEnCuotas) {
          // Guardar como pago único
          const { error: pagoError } = await supabase.from("pagos").insert({
            ...pagoBase,
            monto: montoTotal,
            descripcion: body.descripcion || `Compra de producto`,
            ciclo_cierre: ciclo_cierre.toISOString(),
            cuotas: 1,
            cuota_actual: 1,
            es_cuota: false,
          })

          if (pagoError) {
            console.error("Error al registrar pago:", pagoError)
            // Continuamos aunque haya error, ya que el registro de compra ya se realizó
          }
        } else {
          // Solo guardar las cuotas individuales para evitar doble conteo
          const montoPorCuota = Number((montoTotal / body.cuotas).toFixed(2))
          const cuotasArray = Array.from({ length: body.cuotas }, (_, i) => i + 1)

          // Crear un array de objetos para inserción masiva
          const cuotasInsert = cuotasArray.map((numeroCuota) => {
            // Calcular la fecha de cierre para esta cuota
            const fechaCuota = new Date(ciclo_cierre)
            fechaCuota.setMonth(ciclo_cierre.getMonth() + numeroCuota - 1)

            return {
              ...pagoBase,
              monto: montoPorCuota,
              descripcion: body.descripcion
                ? `${body.descripcion} (Cuota ${numeroCuota}/${body.cuotas})`
                : `Compra de producto (Cuota ${numeroCuota}/${body.cuotas})`,
              ciclo_cierre: fechaCuota.toISOString(),
              cuotas: body.cuotas,
              cuota_actual: numeroCuota,
              es_cuota: true,
              pago_original_id: null, // No necesitamos esto ya que no guardamos el total
              payment_intent_id: `${paymentIntentId}-cuota-${numeroCuota}`,
            }
          })

          // Insertar todas las cuotas en una sola operación
          const { error: cuotasError } = await supabase.from("pagos").insert(cuotasInsert)

          if (cuotasError) {
            console.error("Error al registrar cuotas:", cuotasError)
            // Continuamos aunque haya error, ya que el registro de compra ya se realizó
          }
        }
      }
    }

    return NextResponse.json({ success: true, compra_id: compraId }, { status: 201 })
  } catch (error: any) {
    console.error("Error al procesar la solicitud:", error)
    return NextResponse.json({ error: error.message || "Error al procesar la solicitud" }, { status: 500 })
  }
}
