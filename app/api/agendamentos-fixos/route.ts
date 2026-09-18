// Rota server-side: evita fazer o fetch da planilha diretamente no bundle do cliente.
// `fetchAgendamentosFixos` já trata falhas internamente com fallback fictício,
// então esta rota praticamente não deveria retornar erro.
import { NextResponse } from "next/server";
import { fetchAgendamentosFixos } from "@/lib/google-sheets";

export async function GET() {
  const agendamentos = await fetchAgendamentosFixos();
  return NextResponse.json(agendamentos);
}
