// Rota server-side: evita fazer o fetch da planilha diretamente no bundle do cliente.
import { NextResponse } from "next/server";
import { fetchClientes } from "@/lib/google-sheets";

export async function GET() {
  try {
    const clientes = await fetchClientes();
    return NextResponse.json(clientes);
  } catch (erro) {
    console.error("Erro ao buscar clientes da planilha:", erro);
    return NextResponse.json(
      { error: "Falha ao buscar clientes." },
      { status: 500 },
    );
  }
}
