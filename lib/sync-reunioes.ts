// Gera reuniões "agendada" a partir dos agendamentos fixos, uma por cliente
// pra próxima ocorrência do dia/horário recorrente — assim o dashboard de
// reuniões já nasce com a agenda da semana preenchida, sem precisar que
// alguém agende manualmente cada compromisso fixo.
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { AgendamentoFixo, Reuniao } from "@/lib/types";
import { proximaOcorrenciaDiaSemana } from "@/lib/utils";

export interface ResultadoSyncReunioes {
  success: boolean;
  inseridas: number;
  error?: unknown;
}

/**
 * Para cada agendamento fixo, garante que existe uma reunião "agendada" para
 * a próxima ocorrência do seu dia/horário. Idempotente: casa por
 * `cliente_nome` + `data_reuniao` contra `reunioesExistentes` (já carregadas
 * pelo chamador — evita buscar de novo o que o caller já tem em mãos) e só
 * insere o que ainda não existe.
 */
export async function syncAgendamentosFixosToReunioes(
  agendamentosFixos: AgendamentoFixo[],
  reunioesExistentes: Reuniao[],
  hoje: Date = new Date(),
): Promise<ResultadoSyncReunioes> {
  if (!supabase) return { success: true, inseridas: 0 };

  try {
    const existentes = new Set(
      reunioesExistentes.map((r) => `${r.cliente_nome}|${r.data_reuniao}`),
    );

    const aInserir = agendamentosFixos
      .map((agendamento) => ({
        cliente_nome: agendamento.cliente_nome,
        consultora_id: agendamento.consultora_id,
        data_reuniao: format(
          proximaOcorrenciaDiaSemana(agendamento.dia_semana, hoje),
          "yyyy-MM-dd",
        ),
        status: "agendada" as const,
      }))
      .filter((r) => !existentes.has(`${r.cliente_nome}|${r.data_reuniao}`));

    if (aInserir.length === 0) {
      return { success: true, inseridas: 0 };
    }

    const { error } = await supabase.from("reunioes").insert(aInserir);
    if (error) throw error;

    return { success: true, inseridas: aInserir.length };
  } catch (error) {
    console.error("Erro sincronizando agendamentos_fixos -> reunioes:", error);
    return { success: false, inseridas: 0, error };
  }
}
