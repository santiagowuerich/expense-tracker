import { render, screen, waitFor } from "@testing-library/react"
import ResumenPage from "@/app/resumen/page"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, beforeEach, it, expect } from "vitest"

// Mock de useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock de createClient
vi.mock("@/lib/supabase-browser", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => {
      if (table === "tarjetas") {
        return {
          select: vi.fn(() => ({
            data: [
              { id: "1", alias: "Visa", cierre_dia: 15, venc_dia: 20 },
              { id: "2", alias: "Mastercard", cierre_dia: 10, venc_dia: 15 },
            ],
            error: null,
          })),
        }
      } else if (table === "pagos") {
        return {
          select: vi.fn(() => ({
            neq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [
                  {
                    id: "1",
                    tarjeta_id: "1",
                    monto: 100,
                    fecha: new Date().toISOString(),
                    descripcion: "Pago con tarjeta",
                    ciclo_cierre: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString(),
                    cuotas: 1,
                    cuota_actual: 1,
                    es_cuota: false,
                    pago_original_id: null,
                    producto_id: null,
                    payment_intent_id: "1",
                    payment_method: "tarjeta",
                    productos: null,
                  },
                  {
                    id: "2",
                    tarjeta_id: null,
                    monto: 50,
                    fecha: new Date().toISOString(),
                    descripcion: "Pago en efectivo",
                    ciclo_cierre: null,
                    cuotas: 1,
                    cuota_actual: 1,
                    es_cuota: false,
                    pago_original_id: null,
                    producto_id: null,
                    payment_intent_id: "2",
                    payment_method: "efectivo",
                    productos: null,
                  },
                ],
                error: null,
              })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          data: [],
          error: null,
        })),
      }
    }),
  })),
}))

describe("ResumenPage", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  it("muestra el total general correctamente incluyendo todos los métodos de pago", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResumenPage />
      </QueryClientProvider>,
    )

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(screen.getByText("Total General")).toBeInTheDocument()
    })

    // Verificar que el total general incluye todos los pagos (150 = 100 tarjeta + 50 efectivo)
    await waitFor(() => {
      const totalGeneralElement = screen.getByText("$150,00")
      expect(totalGeneralElement).toBeInTheDocument()
    })
  })

  it("muestra el total a pagar próximo mes solo con pagos de tarjeta", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResumenPage />
      </QueryClientProvider>,
    )

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(screen.getByText("Total a pagar próximo mes")).toBeInTheDocument()
    })

    // Verificar que el total próximo mes solo incluye pagos con tarjeta (100)
    await waitFor(() => {
      const totalProximoMesElement = screen.getByText("$100,00")
      expect(totalProximoMesElement).toBeInTheDocument()
    })
  })

  it("muestra la descripción correcta para el total general", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResumenPage />
      </QueryClientProvider>,
    )

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(
        screen.getByText("Suma de todos los gastos registrados. Incluye efectivo y transferencias."),
      ).toBeInTheDocument()
    })
  })

  it("muestra la descripción correcta para el total a pagar próximo mes", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResumenPage />
      </QueryClientProvider>,
    )

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(
        screen.getByText("Comprende los movimientos con tarjeta con ciclo de cierre del próximo mes."),
      ).toBeInTheDocument()
    })
  })
})
