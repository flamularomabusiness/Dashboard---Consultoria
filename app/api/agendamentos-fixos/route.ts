// Rota server-side: evita fazer o fetch da planilha diretamente no bundle do cliente.
//
// `configurado` só é true quando os dados vieram MESMO da planilha nesta chamada.
// O dashboard sincroniza (insere/atualiza) esses dados no Supabase, então se a
// planilha não está configurada OU a busca falhou (instabilidade do Sheets), a
// resposta traz o fallback fictício com `configurado: false` — e o cliente nunca
// grava dados fictícios no banco.
import { NextResponse } from "next/server";
import { exigirAcessoInsight } from "@/lib/auth-server";
import {
  fetchAgendamentosFixos,
  fetchAgendamentosFixosEstrito,
  isGoogleSheetsConfigured,
} from "@/lib/google-sheets";

export async function GET(request: Request) {
  const negado = await exigirAcessoInsight(request);
  if (negado) return negado;

  if (isGoogleSheetsConfigured) {
    try {
      const agendamentos = await fetchAgendamentosFixosEstrito();
      return NextResponse.json({ configurado: true, agendamentos });
    } catch (erro) {
      console.error("Planilha indisponível; sincronização ignorada nesta carga:", erro);
    }
  }

  return NextResponse.json({ configurado: false, agendamentos: await fetchAgendamentosFixos() });
}
