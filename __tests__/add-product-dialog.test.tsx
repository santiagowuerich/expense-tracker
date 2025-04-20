import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AddProductDialog from "@/components/add-product-dialog"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queries"

// Mock de las dependencias
jest.mock("@/lib/supabase-browser", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: [{ id: "1" }], error: null })),
      })),
    })),
  })),
}))

jest.mock("@/components/ui/use-toast", () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
  })),
}))

describe("AddProductDialog", () => {
  const setup = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AddProductDialog>
          <button>Abrir diálogo</button>
        </AddProductDialog>
      </QueryClientProvider>,
    )
  }

  it("renderiza correctamente el botón trigger", () => {
    setup()
    expect(screen.getByText("Abrir diálogo")).toBeInTheDocument()
  })

  it("abre el diálogo al hacer clic en el trigger", async () => {
    setup()
    fireEvent.click(screen.getByText("Abrir diálogo"))

    await waitFor(() => {
      expect(screen.getByText("Agregar nuevo producto")).toBeInTheDocument()
    })
  })

  it("muestra un error cuando se envía el formulario sin nombre", async () => {
    setup()
    fireEvent.click(screen.getByText("Abrir diálogo"))

    await waitFor(() => {
      expect(screen.getByText("Agregar nuevo producto")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Guardar"))

    await waitFor(() => {
      expect(screen.getByText("El nombre es requerido")).toBeInTheDocument()
    })
  })

  it("envía el formulario correctamente con datos válidos", async () => {
    setup()
    fireEvent.click(screen.getByText("Abrir diálogo"))

    await waitFor(() => {
      expect(screen.getByText("Agregar nuevo producto")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Producto de prueba" } })
    fireEvent.change(screen.getByLabelText("Stock inicial"), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText("Costo unitario"), { target: { value: "100.50" } })

    fireEvent.click(screen.getByText("Guardar"))

    await waitFor(() => {
      // El diálogo debería cerrarse después de enviar el formulario
      expect(screen.queryByText("Agregar nuevo producto")).not.toBeInTheDocument()
    })
  })
})
