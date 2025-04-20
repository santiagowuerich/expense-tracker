export function GET() {
  // Nota: No usamos async/await aquí para probar si ese es el problema
  const data = {
    message: "Respuesta alternativa",
    timestamp: Date.now(),
  }

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
