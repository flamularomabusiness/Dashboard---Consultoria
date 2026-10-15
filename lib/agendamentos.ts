// Agendamentos fixos (horário semanal recorrente por cliente):
// - sincronização planilha (Google Sheets) -> tabela agendamentos_fixos;
// - edição/remoção feitas no INSIGHT.
//
// A planilha é a fonte da verdade, MAS o que for editado/removido no INSIGHT
// precisa prevalecer — senão a próxima sincronização desfaria a mudança. Por isso
// existem duas marcas na tabela (ver supabase/schema.sql):
//   manual = true  -> dia/horário editados aqui; a planilha não sobrescreve mais.
//   ativo  = false -> removido aqui; a planilha não recria e nenhuma reunião é gerada.
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import type { AgendamentoFixo, AgendamentoFixoSheet, Consultora } from "@/lib/types";
import { planejarSincronizacaoAgendamentos, resolverConsultoraId } from "@/lib/utils";

function clienteDoNavegador(): SupabaseClient {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

/**
 * Compara os agendamentos fixos da planilha com os do Supabase e grava o que
 * estiver faltando ou desatualizado (respeitando `manual`/`ativo`, ver
 * `planejarSincronizacaoAgendamentos`). Só deve ser chamada quando `daSheet` veio
 * da planilha real, nunca do fallback fictício. Retorna a lista final.
 *
 * `cliente` é o cliente Supabase a usar: o do navegador (padrão) ou, na rota de
 * cron, um com a service key.
 */
export async function sincronizarAgendamentosComSheets(
  daSheet: AgendamentoFixoSheet[],
  doSupabase: AgendamentoFixo[],
  consultoras: Consultora[],
  cliente: SupabaseClient | null = supabase,
): Promise<AgendamentoFixo[]> {
  if (!cliente) return doSupabase;

  const plano = planejarSincronizacaoAgendamentos(daSheet, doSupabase);

  for (const item of plano.paraInserir) {
    const { error } = await cliente.from("agendamentos_fixos").insert({
      cliente_nome: item.cliente_nome,
      // A planilha traz o nome da consultora (ex. "Tainara Muller"), não o id —
      // a coluna é uuid no Supabase, então precisa resolver antes.
      consultora_id: resolverConsultoraId(item.consultora_id, consultoras),
      dia_semana: item.dia_semana,
      horario: item.horario,
    });
    if (error) {
      console.error(`[Sync agendamentos_fixos] Erro ao inserir "${item.cliente_nome}":`, error);
    }
  }

  for (const { atual, novo } of plano.paraAtualizar) {
    const { error } = await cliente
      .from("agendamentos_fixos")
      .update({
        dia_semana: novo.dia_semana,
        horario: novo.horario,
        consultora_id: resolverConsultoraId(novo.consultora_id, consultoras),
      })
      .eq("id", atual.id);
    if (error) {
      console.error(`[Sync agendamentos_fixos] Erro ao atualizar "${atual.cliente_nome}":`, error);
    }
  }

  if (plano.paraInserir.length === 0 && plano.paraAtualizar.length === 0) {
    return doSupabase;
  }

  const { data } = await cliente.from("agendamentos_fixos").select("*");
  return (data as AgendamentoFixo[] | null) ?? doSupabase;
}

export interface CamposAgendamentoFixo {
  dia_semana?: string;
  horario?: string;
  email_cliente?: string | null;
}

/**
 * Edita dia/horário/e-mail de um agendamento fixo e o marca como `manual`, para
 * a planilha não sobrescrever. Pede as linhas de volta (`.select()`): com RLS, um
 * UPDATE sem permissão afeta 0 linhas sem dar erro — e isso não pode virar "sucesso".
 */
export async function atualizarAgendamentoFixo(
  id: string,
  campos: CamposAgendamentoFixo,
): Promise<AgendamentoFixo> {
  const { data, error } = await clienteDoNavegador()
    .from("agendamentos_fixos")
    .update({ ...campos, manual: true })
    .eq("id", id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Nenhuma linha atualizada (o agendamento não existe mais ou falta permissão).");
  }
  return data[0] as AgendamentoFixo;
}

/**
 * "Deleta" um agendamento fixo: marca `ativo = false` em vez de apagar a linha,
 * porque a planilha ainda tem esse cliente e a sincronização o recriaria. Reuniões
 * já criadas são mantidas (histórico); só deixam de ser geradas novas.
 */
export async function desativarAgendamentoFixo(id: string): Promise<void> {
  const { data, error } = await clienteDoNavegador()
    .from("agendamentos_fixos")
    .update({ ativo: false })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Nenhuma linha atualizada (o agendamento não existe mais ou falta permissão).");
  }
}

/** Dias aceitos num fixo, no formato EXATO que a RPC e a planilha usam (com cedilha). */
export const DIAS_UTEIS_GRAVADOS = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
] as const;

/**
 * As RPCs devolvem a mensagem de erro já em português em `error.message` — é ela
 * que o usuário vê (não adianta repassar PostgrestError cru).
 */
function lancarErroRpc(error: { message?: string } | null): never {
  throw new Error(error?.message || "Não foi possível concluir a operação.");
}

export interface NovoAgendamentoFixoParams {
  clienteId: string;
  /** Nome como o Zoom escreve (vira `cliente_nome` do fixo e das reuniões geradas). */
  nomeZoom: string;
  consultoraId: string;
  diaSemana: (typeof DIAS_UTEIS_GRAVADOS)[number];
  /** "HH:MM" ou "HH:MM:SS". */
  horario: string;
  email?: string | null;
}

/** RPC `criar_agendamento_fixo`: o banco valida a permissão (consultora só cria para si). Devolve o id criado. */
export async function criarAgendamentoFixo(params: NovoAgendamentoFixoParams): Promise<string> {
  const { data, error } = await clienteDoNavegador().rpc("criar_agendamento_fixo", {
    p_cliente_id: params.clienteId,
    p_nome_zoom: params.nomeZoom.trim(),
    p_consultora_id: params.consultoraId,
    p_dia_semana: params.diaSemana,
    p_horario: params.horario.length === 5 ? `${params.horario}:00` : params.horario,
    p_email: params.email?.trim() || null,
  });
  if (error) lancarErroRpc(error);
  return data as string;
}

export interface ResultadoTransferencia {
  reunioes: number;
  contratos: number;
}

/** RPC `transferir_cliente`: move o fixo, as reuniões futuras sem ATA e os contratos para outra consultora. */
export async function transferirCliente(
  fixoId: string,
  paraConsultoraId: string,
): Promise<ResultadoTransferencia> {
  const { data, error } = await clienteDoNavegador().rpc("transferir_cliente", {
    p_fixo_id: fixoId,
    p_para: paraConsultoraId,
  });
  if (error) lancarErroRpc(error);
  const resultado = (data ?? {}) as Partial<ResultadoTransferencia>;
  return { reunioes: Number(resultado.reunioes ?? 0), contratos: Number(resultado.contratos ?? 0) };
}

/**
 * Reativa um fixo desativado (só admin): ativo=true, manual=true (a planilha não o
 * sobrescreve) e inativado_por_plataforma=false. 23505 = já existe outro fixo ativo
 * para o mesmo cliente (índice único no banco).
 */
export async function reativarAgendamentoFixo(id: string): Promise<AgendamentoFixo> {
  const { data, error } = await clienteDoNavegador()
    .from("agendamentos_fixos")
    .update({ ativo: true, manual: true, inativado_por_plataforma: false })
    .eq("id", id)
    .select();
  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um agendamento fixo ativo para este cliente.");
    }
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Nenhuma linha atualizada (o agendamento não existe mais ou falta permissão).");
  }
  return data[0] as AgendamentoFixo;
}

/**
 * "Agora" no horário de São Paulo, mesmo rodando num servidor em UTC (cron da
 * Vercel). Usa o relógio de parede de lá como se fosse local, o que é o que
 * `format`/`getDay` do date-fns esperam.
 */
export function agoraSaoPaulo(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
