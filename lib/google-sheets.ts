// Lê clientes e agendamentos fixos a partir do export CSV público de uma
// planilha do Google Sheets.
//
// Configuração (.env.local, veja .env.local.example):
//   GOOGLE_SHEETS_EXPORT_URL=https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>
//
// A planilha precisa estar acessível ("qualquer pessoa com o link pode visualizar")
// e ter, na primeira linha, as colunas: cliente_nome, consultora_id, dia_semana, horario.
// `dia_semana`/`horario` podem ficar em branco para um cliente sem horário fixo.
//
// Enquanto essa variável não existir (ou a busca falhar), as funções abaixo
// retornam dados fictícios de lib/mock-data.ts — assim o dashboard é testável
// antes da planilha real ser fornecida ou em caso de instabilidade do Sheets.
import Papa from "papaparse";
import { mockAgendamentosFixosSheet, mockClientes } from "@/lib/mock-data";
import type { AgendamentoFixoSheet, Cliente } from "@/lib/types";

const SHEETS_EXPORT_URL = process.env.GOOGLE_SHEETS_EXPORT_URL;

export const isGoogleSheetsConfigured = Boolean(SHEETS_EXPORT_URL);

interface LinhaCsv {
  cliente_nome?: string;
  consultora_id?: string;
  dia_semana?: string;
  horario?: string;
}

/** Busca e parseia o CSV da planilha. Lança erro se a URL não estiver configurada ou a busca falhar. */
async function buscarLinhasCsv(): Promise<LinhaCsv[]> {
  if (!SHEETS_EXPORT_URL) {
    throw new Error("GOOGLE_SHEETS_EXPORT_URL não configurada.");
  }

  const resposta = await fetch(SHEETS_EXPORT_URL, { cache: "no-store" });
  if (!resposta.ok) {
    throw new Error(`Falha ao buscar a planilha (status ${resposta.status}).`);
  }
  const csv = await resposta.text();

  const resultado = Papa.parse<LinhaCsv>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (resultado.errors.length > 0) {
    throw new Error(`Falha ao interpretar o CSV: ${resultado.errors[0].message}`);
  }

  return resultado.data;
}

/** Busca a lista de clientes: da planilha quando configurada, senão dados fictícios. */
export async function fetchClientes(): Promise<Cliente[]> {
  if (!SHEETS_EXPORT_URL) {
    return mockClientes;
  }

  let linhas: LinhaCsv[];
  try {
    linhas = await buscarLinhasCsv();
  } catch (erro) {
    throw new Error(`Falha ao buscar a planilha de clientes: ${erro}`);
  }

  return linhas
    .filter((linha) => Boolean(linha.cliente_nome))
    .map((linha) => ({
      cliente_nome: (linha.cliente_nome ?? "").trim(),
      consultora_id: (linha.consultora_id ?? "").trim(),
    }));
}

/**
 * Busca os agendamentos fixos (dia da semana + horário) direto da mesma planilha.
 * Diferente de `fetchClientes`, qualquer falha (planilha não configurada, rede,
 * CSV inválido) cai no fallback de dados fictícios em vez de propagar o erro —
 * a tela de agendamentos fixos nunca deve ficar vazia por uma falha do Sheets.
 */
export async function fetchAgendamentosFixos(): Promise<AgendamentoFixoSheet[]> {
  try {
    const linhas = await buscarLinhasCsv();

    return linhas
      .filter(
        (linha) =>
          Boolean(linha.cliente_nome) && Boolean(linha.dia_semana) && Boolean(linha.horario),
      )
      .map((linha) => ({
        cliente_nome: (linha.cliente_nome ?? "").trim(),
        consultora_id: (linha.consultora_id ?? "").trim(),
        dia_semana: (linha.dia_semana ?? "").trim(),
        horario: (linha.horario ?? "").trim(),
      }));
  } catch (erro) {
    console.error(
      "Falha ao buscar agendamentos fixos da planilha, usando dados fictícios:",
      erro,
    );
    return mockAgendamentosFixosSheet;
  }
}
