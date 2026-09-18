export { cn } from "cn";

import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isAfter,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgendamentoFixo, AgendamentoFixoSheet, Reuniao, StatusVisual } from "@/lib/types";

/** Prazo (em dias) a partir do qual uma reunião sem ATA finalizada é considerada atrasada. */
export const LIMITE_DIAS_ATRASO = 7;

/** Formata uma data ISO para o padrão brasileiro (dd/MM/yyyy). Retorna "-" se vazia. */
export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return "-";
  return format(parseISO(dataISO), "dd/MM/yyyy", { locale: ptBR });
}

/** Calcula quantos dias já se passaram desde `dataISO` até hoje (null se não houver data). */
export function diasDesde(
  dataISO: string | null | undefined,
  hoje: Date = new Date(),
): number | null {
  if (!dataISO) return null;
  return differenceInCalendarDays(hoje, parseISO(dataISO));
}

/**
 * Uma reunião "agendada" já é considerada "ocorrida" a partir da sua data
 * (mesmo sem nenhuma ação manual) — evita a necessidade de um passo extra só
 * para marcar que a reunião aconteceu antes de poder registrar a ATA.
 */
function reuniaoJaOcorreu(reuniao: Reuniao, hoje: Date = new Date()): boolean {
  return reuniao.status !== "agendada" || !isAfter(parseISO(reuniao.data_reuniao), hoje);
}

/** Dada todas as reuniões de um cliente, separa a última já realizada da próxima agendada. */
export function separarUltimaEProximaReuniao(
  reunioesDoCliente: Reuniao[],
  hoje: Date = new Date(),
): { ultimaReuniao: Reuniao | null; proximaReuniao: Reuniao | null } {
  const realizadas = reunioesDoCliente
    .filter((r) => reuniaoJaOcorreu(r, hoje))
    .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao));

  const agendadas = reunioesDoCliente
    .filter((r) => !reuniaoJaOcorreu(r, hoje))
    .sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao));

  return {
    ultimaReuniao: realizadas[0] ?? null,
    proximaReuniao: agendadas[0] ?? null,
  };
}

/**
 * Deriva o status visual (✅ completa / 📁 pendente_drive / 🔴 atrasado) a partir
 * da última reunião realizada:
 * - Sem reunião registrada, ou atrasada há mais de `LIMITE_DIAS_ATRASO` dias -> atrasado
 * - ATA já finalizada -> completa
 * - Caso contrário (ainda sem ATA ou já com ATA, aguardando o link do Drive) -> pendente_drive
 */
export function calcularStatusVisual(
  ultimaReuniao: Reuniao | null,
  hoje: Date = new Date(),
): StatusVisual {
  if (!ultimaReuniao) return "atrasado";
  if (ultimaReuniao.status === "finalizada") return "completa";

  const dias = diasDesde(ultimaReuniao.data_reuniao, hoje) ?? 0;
  if (dias > LIMITE_DIAS_ATRASO) return "atrasado";
  return "pendente_drive";
}

/** Verifica se uma data ISO cai dentro da semana atual (segunda a domingo). */
export function estaNaSemanaAtual(
  dataISO: string | null | undefined,
  hoje: Date = new Date(),
): boolean {
  if (!dataISO) return false;
  const inicio = startOfWeek(hoje, { weekStartsOn: 1 });
  const fim = endOfWeek(hoje, { weekStartsOn: 1 });
  return isWithinInterval(parseISO(dataISO), { start: inicio, end: fim });
}

/** true se `dataISO` já passou em relação a `hoje`. */
export function jaPassou(dataISO: string, hoje: Date = new Date()): boolean {
  return isAfter(hoje, parseISO(dataISO));
}

// --- Agendamentos fixos (horário recorrente semanal por cliente) ---

/** Dias da semana em português, na mesma ordem de `Date#getDay()` (0 = domingo). */
export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

/** Remove acentos e sufixo "-feira" para comparar nomes de dia de forma tolerante. */
function normalizarDiaSemana(diaSemana: string): string {
  return diaSemana
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/-feira$/, "")
    .trim();
}

const DIAS_SEMANA_NORMALIZADOS = DIAS_SEMANA.map(normalizarDiaSemana);

/** Converte "segunda", "Terça-feira", etc. no índice de `Date#getDay()` (0-6). */
export function indiceDiaSemana(diaSemana: string): number {
  const indice = DIAS_SEMANA_NORMALIZADOS.indexOf(normalizarDiaSemana(diaSemana));
  return indice === -1 ? 0 : indice;
}

/** Nome do dia da semana (em português) de uma data. */
export function nomeDiaSemana(data: Date): (typeof DIAS_SEMANA)[number] {
  return DIAS_SEMANA[data.getDay()];
}

/**
 * Data da próxima ocorrência de um dia da semana a partir de hoje.
 * Se hoje já é o dia certo, a "próxima ocorrência" é o próprio dia de hoje
 * (ainda dentro do ciclo semanal atual).
 */
export function proximaOcorrenciaDiaSemana(
  diaSemana: string,
  hoje: Date = new Date(),
): Date {
  const alvo = indiceDiaSemana(diaSemana);
  const diasParaFrente = (alvo - hoje.getDay() + 7) % 7;
  return startOfDay(addDays(hoje, diasParaFrente));
}

/** Normaliza um horário "HH:MM" para o formato "HH:MM:SS" usado pelo Supabase. */
export function normalizarHorario(horario: string): string {
  return horario.length === 5 ? `${horario}:00` : horario;
}

export interface PlanoSincronizacaoAgendamentos {
  paraInserir: AgendamentoFixoSheet[];
  paraAtualizar: Array<{ atual: AgendamentoFixo; novo: AgendamentoFixoSheet }>;
  semMudanca: AgendamentoFixoSheet[];
}

/**
 * Compara os agendamentos fixos vindos da planilha com os já salvos no
 * Supabase (casando por `cliente_nome`) e decide o que precisa ser inserido,
 * atualizado (dia/horário mudou) ou já está sincronizado. Não decide nada
 * sobre clientes que existem no Supabase mas não vieram da planilha —
 * a sincronização é só "para frente" (Sheets -> Supabase).
 */
export function planejarSincronizacaoAgendamentos(
  daSheet: AgendamentoFixoSheet[],
  doSupabase: AgendamentoFixo[],
): PlanoSincronizacaoAgendamentos {
  const paraInserir: AgendamentoFixoSheet[] = [];
  const paraAtualizar: PlanoSincronizacaoAgendamentos["paraAtualizar"] = [];
  const semMudanca: AgendamentoFixoSheet[] = [];

  for (const item of daSheet) {
    const horario = normalizarHorario(item.horario);
    const atual = doSupabase.find((a) => a.cliente_nome === item.cliente_nome);

    if (!atual) {
      paraInserir.push({ ...item, horario });
      continue;
    }

    const mudou =
      atual.dia_semana !== item.dia_semana || normalizarHorario(atual.horario) !== horario;

    if (mudou) {
      paraAtualizar.push({ atual, novo: { ...item, horario } });
    } else {
      semMudanca.push(item);
    }
  }

  return { paraInserir, paraAtualizar, semMudanca };
}
