// Gera reuniões "agendada" a partir dos agendamentos fixos, uma por cliente
// pra próxima ocorrência do dia/horário recorrente — assim o dashboard de
// reuniões já nasce com a agenda da semana preenchida, sem precisar que
// alguém agende manualmente cada compromisso fixo.
import { addDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
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
    const existentes = new Set(
      reunioesExistentes.map((r) => `${r.cliente_nome}|${r.data_reuniao}`),
    );

    // Map (não array) pra também deduplicar entre si: se agendamentos_fixos
    // tiver mais de uma linha pro mesmo cliente (duplicata), só uma reunião é
    // criada por cliente+data — sem isso, cada linha duplicada geraria sua
    // própria reunião repetida no mesmo insert.
    const candidatas = new Map<string, Omit<Reuniao, "id" | "created_at">>();
    const hojeISO = format(hoje, "yyyy-MM-dd");
    for (const agendamento of agendamentosFixos) {
      if (agendamento.ativo === false) continue;
      const ocorrencia = proximaOcorrenciaDiaSemana(agendamento.dia_semana, hoje);
      const dataReuniao = format(ocorrencia, "yyyy-MM-dd");
      const chave = `${agendamento.cliente_nome}|${dataReuniao}`;
      if (existentes.has(chave) || candidatas.has(chave)) continue;

      // Reunião remarcada: se o cliente já tem uma "agendada" de hoje até 6 dias
      // depois da ocorrência fixa, o ciclo está coberto — senão remarcar (ex.:
      // segunda -> terça) faria o sync recriar a segunda e duplicar.
      const limiteISO = format(addDays(ocorrencia, 6), "yyyy-MM-dd");
      const cicloCoberto = reunioesExistentes.some(
        (r) =>
          r.cliente_nome === agendamento.cliente_nome &&
          r.status === "agendada" &&
          r.data_reuniao >= hojeISO &&
          r.data_reuniao <= limiteISO,
      );
      if (cicloCoberto) continue;
      candidatas.set(chave, {
        cliente_nome: agendamento.cliente_nome,
        consultora_id: agendamento.consultora_id,
        data_reuniao: dataReuniao,
        status: "agendada",
        zoom_email_recebido: false,
        data_ata_recebida: null,
        resumo_zoom: null,
        arquivo_drive_link: null,
        finalizada_em: null,
      });
    }
    const aInserir = Array.from(candidatas.values());

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
