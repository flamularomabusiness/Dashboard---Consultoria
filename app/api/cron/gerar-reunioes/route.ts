// Cron diário (vercel.json): mantém a agenda em dia mesmo que ninguém abra o
// dashboard. Faz o mesmo que a tela faz ao carregar:
//   1. planilha (Google Sheets) -> agendamentos_fixos (respeitando o que foi
//      editado/removido no INSIGHT: colunas `manual` e `ativo`);
//   2. agendamentos_fixos -> reunioes (próxima ocorrência de cada um, sem duplicar).
//
// Não há usuário logado num cron, então usa a service key do Supabase (ignora RLS).
// Ela fica só em variável de ambiente do servidor — NUNCA com prefixo NEXT_PUBLIC_.
// Variáveis necessárias na Vercel (sem elas a rota responde 503 e não faz nada):
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase > Project Settings > API > service_role)
//   CRON_SECRET                (texto aleatório longo; a Vercel o envia como Bearer)
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { agoraSaoPaulo, sincronizarAgendamentosComSheets } from "@/lib/agendamentos";
import { fetchAgendamentosFixosEstrito, isGoogleSheetsConfigured } from "@/lib/google-sheets";
import { syncAgendamentosFixosToReunioes } from "@/lib/sync-reunioes";
import type { AgendamentoFixo, Consultora, Reuniao } from "@/lib/types";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mpzhmkucdpugceflyltx.supabase.co";

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo || !serviceKey) {
    return NextResponse.json(
      { error: "Cron não configurado: defina CRON_SECRET e SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const cliente = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [consultoras, agendamentos, reunioes] = await Promise.all([
      cliente.from("consultoras").select("*"),
      cliente.from("agendamentos_fixos").select("*"),
      cliente.from("reunioes").select("*"),
    ]);
    const erro = consultoras.error ?? agendamentos.error ?? reunioes.error;
    if (erro) throw erro;

    let fixos = (agendamentos.data ?? []) as AgendamentoFixo[];

    // Planilha: só sincroniza com dados REAIS. Se estiver fora do ar, pula essa etapa
    // (nunca grava o fallback fictício) e segue gerando com o que já está no banco.
    let planilha: "sincronizada" | "indisponivel" | "nao_configurada" = "nao_configurada";
    if (isGoogleSheetsConfigured) {
      try {
        const daSheet = await fetchAgendamentosFixosEstrito();
        fixos = await sincronizarAgendamentosComSheets(
          daSheet,
          fixos,
          (consultoras.data ?? []) as Consultora[],
          cliente,
        );
        planilha = "sincronizada";
      } catch (e) {
        console.error("[cron gerar-reunioes] Planilha indisponível:", e);
        planilha = "indisponivel";
      }
    }

    const resultado = await syncAgendamentosFixosToReunioes(
      fixos,
      (reunioes.data ?? []) as Reuniao[],
      agoraSaoPaulo(),
      cliente,
    );
    if (!resultado.success) throw resultado.error;

    return NextResponse.json({
      ok: true,
      planilha,
      agendamentosFixos: fixos.filter((a) => a.ativo !== false).length,
      reunioesCriadas: resultado.inseridas,
    });
  } catch (e) {
    console.error("[cron gerar-reunioes] Falhou:", e);
    return NextResponse.json({ ok: false, error: "Falha ao gerar reuniões." }, { status: 500 });
  }
}
