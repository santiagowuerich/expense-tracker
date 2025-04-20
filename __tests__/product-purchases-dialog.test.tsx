import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ProductPurchasesDialog from "@/components/product-purchases-dialog"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queries"

// Mock de las dependencias
jest.mock("@/lib/supabase-browser", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  })),
}))

describe("ProductPurchasesDialog", () => {
  const setup = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ProductPurchasesDialog productoId="123" productoNombre="Producto de prueba" />
      </QueryClientProvider>,
    )
  }

  it("renderiza correctamente el botón trigger", () => {
    setup()
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("abre el diálogo al hacer clic en el trigger", async () => {
    setup()
    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(screen.getByText("Compras de Producto de prueba")).toBeInTheDocument()
    })
  })

  it("muestra el mensaje de estado vacío cuando no hay compras", async () => {
    setup()
    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(screen.getByText("Sin compras registradas.")).toBeInTheDocument()
    })
  })
})
