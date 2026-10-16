// Lista de clientes da tabela principal do dashboard "/": os da planilha + os que só
// existem em agendamentos_fixos ativos (ex.: fixo criado no INSIGHT para um cliente
// que não está na planilha). A planilha continua sendo a fonte da lista; os fixos só
// completam o que falta.
import { normalizarNome } from "@/lib/nomes-cliente";
import type { AgendamentoFixo, Cliente, Reuniao } from "@/lib/types";

/** Fixo que vale para a tabela: ativo e não inativado pela plataforma. */
function fixoAtivo(fixo: AgendamentoFixo): boolean {
  return fixo.ativo !== false && fixo.inativado_por_plataforma !== true;
}

/**
 * União dos clientes da planilha com os clientes dos fixos ativos.
 * - Deduplica pelo nome normalizado (caixa, acento, pontuação, LTDA): quem já está na
 *   planilha NÃO é repetido, mesmo que o fixo grafe o nome um pouco diferente.
 * - Para o cliente que só vem do fixo, a consultora é a do fixo (`consultora_id`).
 * - Vários fixos do mesmo cliente viram uma só linha (vale o primeiro).
 * - A ordem é: planilha primeiro, depois os extras dos fixos.
 */
export function unirClientesComFixos(
  clientesPlanilha: Cliente[],
  agendamentosFixos: AgendamentoFixo[],
): Cliente[] {
  const jaTem = new Set(clientesPlanilha.map((c) => normalizarNome(c.cliente_nome)));
  const extras: Cliente[] = [];

  for (const fixo of agendamentosFixos) {
    if (!fixoAtivo(fixo)) continue;
    const chave = normalizarNome(fixo.cliente_nome);
    if (!chave || jaTem.has(chave)) continue;
    jaTem.add(chave);
    extras.push({ cliente_nome: fixo.cliente_nome, consultora_id: fixo.consultora_id ?? "" });
  }

  return extras.length === 0 ? clientesPlanilha : [...clientesPlanilha, ...extras];
}

/**
 * Agrupa as reuniões pelo nome normalizado do cliente. Assim a linha de um cliente casa
 * com as reuniões mesmo quando o nome da planilha e o do fixo diferem só na grafia.
 */
export function agruparReunioesPorCliente(reunioes: Reuniao[]): Map<string, Reuniao[]> {
  const mapa = new Map<string, Reuniao[]>();
  for (const r of reunioes) {
    const chave = normalizarNome(r.cliente_nome);
    const lista = mapa.get(chave);
    if (lista) lista.push(r);
    else mapa.set(chave, [r]);
  }
  return mapa;
}
