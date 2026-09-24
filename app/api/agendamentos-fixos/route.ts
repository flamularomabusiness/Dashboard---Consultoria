// Rota server-side: evita fazer o fetch da planilha diretamente no bundle do cliente.
// `fetchAgendamentosFixos` já trata falhas internamente com fallback fictício,
// então esta rota praticamente não deveria retornar erro.
//
// Expõe `configurado` para que o cliente saiba se `agendamentos` veio mesmo da
// planilha ou é fallback fictício — importante porque o dashboard sincroniza
// (insere/atualiza) esses dados no Supabase, e nunca deve gravar dados
// fictícios lá quando a planilha real não está configurada.
import { NextResponse } from "next/server";
import { fetchAgendamentosFixos, isGoogleSheetsConfigured } from "@/lib/google-sheets";

export async function GET() {
  const agendamentos = await fetchAgendamentosFixos();
  return NextResponse.json({ configurado: isGoogleSheetsConfigured, agendamentos });
}
