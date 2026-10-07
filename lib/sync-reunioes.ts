// Gera reuniões "agendada" a partir dos agendamentos fixos, uma por cliente
// pra próxima ocorrência do dia/horário recorrente — assim o dashboard de
// reuniões já nasce com a agenda da semana preenchida, sem precisar que
// alguém agende manualmente cada compromisso fixo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AgendamentoFixo, Reuniao } from "@/lib/types";
import { planejarReunioesAutomaticas } from "@/lib/utils";

export interface ResultadoSyncReunioes {
  success: boolean;
  inseridas: number;
  error?: unknown;
}

/**
 * Para cada agendamento fixo, garante que existe uma reunião "agendada" para
 * a próxima ocorrência do seu dia/horário (e a da semana seguinte, quando a
 * ocorrência é hoje — ver `planejarReunioesAutomaticas`). Idempotente: casa por
 * `cliente_nome` + `data_reuniao` contra `reunioesExistentes` (já carregadas
 * pelo chamador — evita buscar de novo o que o caller já tem em mãos) e só
 * insere o que ainda não existe. Agendamentos removidos no INSIGHT
 * (`ativo === false`) não geram reunião.
 *
 * `cliente` é o cliente Supabase a usar: o do navegador (padrão) ou, na rota de
 * cron, um com a service key (não há usuário logado lá).
 */
export async function syncAgendamentosFixosToReunioes(
  agendamentosFixos: AgendamentoFixo[],
  reunioesExistentes: Reuniao[],
  hoje: Date = new Date(),
  cliente: SupabaseClient | null = supabase,
): Promise<ResultadoSyncReunioes> {
  if (!cliente) return { success: true, inseridas: 0 };

  try {
    const aInserir = planejarReunioesAutomaticas(agendamentosFixos, reunioesExistentes, hoje);

    if (aInserir.length === 0) {
      return { success: true, inseridas: 0 };
    }

    const { error } = await cliente.from("reunioes").insert(aInserir);
    if (error) throw error;

    return { success: true, inseridas: aInserir.length };
  } catch (error) {
    console.error("Erro sincronizando agendamentos_fixos -> reunioes:", error);
    return { success: false, inseridas: 0, error };
  }
}
