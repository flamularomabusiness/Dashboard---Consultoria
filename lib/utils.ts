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
import type {
  AgendamentoFixo,
  AgendamentoFixoSheet,
  Consultora,
  Reuniao,
  StatusReuniaoCalculado,
} from "@/lib/types";

/** Formata uma data ISO para o padrão brasileiro (dd/MM/yyyy). Retorna "-" se vazia. */
export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return "-";
  return format(parseISO(dataISO), "dd/MM/yyyy", { locale: ptBR });
}

/** "Razão Social (FANTASIA)" quando há nome fantasia; senão só a razão social. */
export function formatarNomeCliente(
  razaoSocial: string,
  nomeFantasia?: string | null,
): string {
  const fantasia = nomeFantasia?.trim();
  return fantasia ? `${razaoSocial} (${fantasia})` : razaoSocial;
}

/** Formata um valor numérico como moeda BRL (ex.: "R$ 45.000,00"). Retorna "-" se nulo. */
export function formatarMoedaBR(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
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
 * Data de `hoje` no fuso LOCAL, como "yyyy-MM-dd". Não use `toISOString()` para
 * isso: ele converte para UTC, e no Brasil (UTC-3) depois das 21h o "dia" UTC já
 * é o de amanhã — uma reunião de hoje apareceria como atrasada.
 */
export function dataLocalISO(hoje: Date = new Date()): string {
  return format(hoje, "yyyy-MM-dd");
}

/**
 * ÚNICA fonte da verdade do status exibido de uma reunião (tabela, modal,
 * filtros e contadores devem usar só esta função):
 * - finalizada / pendente_drive (no banco) -> iguais
 * - agendada e data >= hoje -> "agendada" (inclui hoje)
 * - agendada e data < hoje -> "atrasado" (calculado, não é gravado no banco)
 * Compara datas como strings "yyyy-MM-dd" (sem horas, sem fuso).
 */
export function calcularStatusReuniao(
  reuniao: Pick<Reuniao, "status" | "data_reuniao">,
  hoje: Date = new Date(),
): StatusReuniaoCalculado {
  if (reuniao.status === "finalizada") return "finalizada";
  if (reuniao.status === "pendente_drive") return "pendente_drive";
  return reuniao.data_reuniao.slice(0, 10) < dataLocalISO(hoje) ? "atrasado" : "agendada";
}

/**
 * Semana atual (segunda a domingo) como datas "yyyy-MM-dd" no fuso local, prontas
 * para comparar com `data_reuniao` por string (sem horas, sem UTC).
 */
export function obterSemanaAtual(hoje: Date = new Date()): { inicio: string; fim: string } {
  return {
    inicio: format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    fim: format(endOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

export interface StatsReunioes {
  /** Finalizadas com data na semana atual. */
  finalizadasSemana: number;
  /** Todas as reuniões da semana atual, em qualquer status. */
  totalSemana: number;
  /** finalizadasSemana / totalSemana, arredondado; 0 se não há reunião na semana. */
  taxaSucessoSemana: number;
  /** Reuniões com ATA recebida e Drive pendente (todas as datas). */
  pendenteDrive: number;
  /** Reuniões agendadas com data já passada (todas as datas). */
  atrasadas: number;
}

/** Números dos cards do topo do dashboard, calculados a partir da lista de reuniões. */
export function calcularStatsReunioes(
  reunioes: Pick<Reuniao, "status" | "data_reuniao">[],
  hoje: Date = new Date(),
): StatsReunioes {
  const { inicio, fim } = obterSemanaAtual(hoje);
  let finalizadasSemana = 0;
  let totalSemana = 0;
  let pendenteDrive = 0;
  let atrasadas = 0;

  for (const r of reunioes) {
    const status = calcularStatusReuniao(r, hoje);
    const data = r.data_reuniao.slice(0, 10);
    if (data >= inicio && data <= fim) {
      totalSemana += 1;
      if (status === "finalizada") finalizadasSemana += 1;
    }
    if (status === "pendente_drive") pendenteDrive += 1;
    else if (status === "atrasado") atrasadas += 1;
  }

  return {
    finalizadasSemana,
    totalSemana,
    taxaSucessoSemana: totalSemana > 0 ? Math.round((finalizadasSemana / totalSemana) * 100) : 0,
    pendenteDrive,
    atrasadas,
  };
}

/**
 * Uma reunião "agendada" já é considerada "ocorrida" a partir da sua data
 * (inclusive hoje, mesmo sem nenhuma ação manual) — evita a necessidade de um
 * passo extra só para marcar que a reunião aconteceu antes de poder registrar a ATA.
 */
function reuniaoJaOcorreu(reuniao: Reuniao, hoje: Date = new Date()): boolean {
  return reuniao.status !== "agendada" || reuniao.data_reuniao.slice(0, 10) <= dataLocalISO(hoje);
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
 * Reunião que define o status mostrado na linha do cliente — a que precisa de atenção:
 * 1. a última (já ocorrida/de hoje), se ainda não estiver finalizada (agendada, pendente ou atrasada);
 * 2. senão, a próxima agendada (futura), se houver;
 * 3. senão, a última (finalizada).
 * `null` se o cliente não tem nenhuma reunião.
 */
export function reuniaoEmFoco(
  ultimaReuniao: Reuniao | null,
  proximaReuniao: Reuniao | null,
  hoje: Date = new Date(),
): Reuniao | null {
  if (ultimaReuniao && calcularStatusReuniao(ultimaReuniao, hoje) !== "finalizada") {
    return ultimaReuniao;
  }
  return proximaReuniao ?? ultimaReuniao;
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

/**
 * Remove acentos, espaços e sufixo "feira" para comparar nomes de dia de forma
 * tolerante — a planilha já veio com variações como "quinta- feira" (espaço
 * extra depois do hífen), então os espaços são removidos antes de tentar
 * casar o sufixo.
 */
function normalizarDiaSemana(diaSemana: string): string {
  return diaSemana
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-?feira$/, "")
    .trim();
}

const DIAS_SEMANA_NORMALIZADOS = DIAS_SEMANA.map(normalizarDiaSemana);

/** Converte "segunda", "Terça-feira", etc. no índice de `Date#getDay()` (0-6). */
export function indiceDiaSemana(diaSemana: string): number {
  const indice = DIAS_SEMANA_NORMALIZADOS.indexOf(normalizarDiaSemana(diaSemana));
  return indice === -1 ? 0 : indice;
}

/** Nome do dia como gravado em agendamentos_fixos (igual à planilha: "segunda-feira", "sábado"...). */
export const DIAS_SEMANA_GRAVADOS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

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

/**
 * Resolve o `consultora_id` que vem da planilha (que pode ser o nome da
 * consultora, ex. "Tainara Muller", em vez do id real) para o id de verdade
 * da tabela `consultoras` — essa coluna é `uuid` no Supabase, então gravar o
 * nome direto falha com "invalid input syntax for type uuid". Casa primeiro
 * por id exato (planilhas antigas que já usem o id certo) e, se não achar,
 * por nome (sem diferenciar maiúsculas/espaços nas pontas).
 */
export function resolverConsultoraId(
  valor: string | null | undefined,
  consultoras: Consultora[],
): string | null {
  if (!valor) return null;
  const porId = consultoras.find((c) => c.id === valor);
  if (porId) return porId.id;
  const alvo = valor.trim().toLowerCase();
  return consultoras.find((c) => c.nome.trim().toLowerCase() === alvo)?.id ?? null;
}

/** Reunião nova a inserir, gerada a partir de um agendamento fixo. */
export type ReuniaoGerada = Omit<Reuniao, "id" | "created_at">;

/**
 * Decide quais reuniões "agendada" criar a partir dos agendamentos fixos (função
 * pura — a gravação fica em lib/sync-reunioes.ts). Regras, por agendamento ativo:
 * 1. Próxima ocorrência do dia fixo (hoje conta). Não cria se já existe reunião do
 *    cliente nessa data, ou se o ciclo já está coberto por uma "agendada" de hoje
 *    até 6 dias depois da ocorrência (reunião remarcada — senão remarcar de
 *    segunda para terça faria o sistema recriar a segunda).
 * 2. Se a ocorrência é HOJE, também garante a da semana seguinte (+7 dias).
 *    Sem isso, no dia da reunião a coluna "Próxima Reunião" ficaria vazia até o dia
 *    seguinte. Não cria se o cliente já tem alguma "agendada" depois de hoje
 *    (inclui reunião remarcada para amanhã).
 * Deduplica entre agendamentos repetidos do mesmo cliente.
 */
export function planejarReunioesAutomaticas(
  agendamentosFixos: AgendamentoFixo[],
  reunioesExistentes: Reuniao[],
  hoje: Date = new Date(),
): ReuniaoGerada[] {
  const existentes = new Set(reunioesExistentes.map((r) => `${r.cliente_nome}|${r.data_reuniao}`));
  const candidatas = new Map<string, ReuniaoGerada>();
  const hojeISO = dataLocalISO(hoje);

  const adicionar = (agendamento: AgendamentoFixo, dataReuniao: string) => {
    candidatas.set(`${agendamento.cliente_nome}|${dataReuniao}`, {
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
  };
  const jaTemFuturaAgendada = (clienteNome: string) =>
    reunioesExistentes.some(
      (r) => r.cliente_nome === clienteNome && r.status === "agendada" && r.data_reuniao > hojeISO,
    ) ||
    Array.from(candidatas.values()).some(
      (c) => c.cliente_nome === clienteNome && c.data_reuniao > hojeISO,
    );

  for (const agendamento of agendamentosFixos) {
    if (agendamento.ativo === false) continue;

    const ocorrencia = proximaOcorrenciaDiaSemana(agendamento.dia_semana, hoje);
    const dataReuniao = format(ocorrencia, "yyyy-MM-dd");
    const chave = `${agendamento.cliente_nome}|${dataReuniao}`;

    if (!existentes.has(chave) && !candidatas.has(chave)) {
      const limiteISO = format(addDays(ocorrencia, 6), "yyyy-MM-dd");
      const cicloCoberto = reunioesExistentes.some(
        (r) =>
          r.cliente_nome === agendamento.cliente_nome &&
          r.status === "agendada" &&
          r.data_reuniao >= hojeISO &&
          r.data_reuniao <= limiteISO,
      );
      if (!cicloCoberto) adicionar(agendamento, dataReuniao);
    }

    if (dataReuniao === hojeISO) {
      const proxima = format(addDays(ocorrencia, 7), "yyyy-MM-dd");
      const chaveProxima = `${agendamento.cliente_nome}|${proxima}`;
      if (
        !existentes.has(chaveProxima) &&
        !candidatas.has(chaveProxima) &&
        !jaTemFuturaAgendada(agendamento.cliente_nome)
      ) {
        adicionar(agendamento, proxima);
      }
    }
  }

  return Array.from(candidatas.values());
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

    // Removido ou editado no INSIGHT: a decisão feita aqui vale mais que a planilha
    // (senão a próxima sincronização recriaria/desfaria a mudança).
    if (atual && (atual.ativo === false || atual.manual === true)) {
      semMudanca.push(item);
      continue;
    }

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
