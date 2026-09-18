// Lê a lista de clientes a partir do export CSV público de uma planilha do Google Sheets.
//
// Configuração (.env.local, veja .env.local.example):
//   GOOGLE_SHEETS_EXPORT_URL=https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>
//
// A planilha precisa estar acessível ("qualquer pessoa com o link pode visualizar")
// e ter, na primeira linha, as colunas: cliente_nome, consultora_id.
//
// Enquanto essa variável não existir, `fetchClientes` retorna os dados fictícios
// de lib/mock-data.ts — assim o dashboard é testável antes da planilha real ser fornecida.
import Papa from "papaparse";
import { mockClientes } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";

const SHEETS_EXPORT_URL = process.env.GOOGLE_SHEETS_EXPORT_URL;

export const isGoogleSheetsConfigured = Boolean(SHEETS_EXPORT_URL);

interface LinhaCsv {
  cliente_nome?: string;
  consultora_id?: string;
}

/** Busca a lista de clientes: da planilha quando configurada, senão dados fictícios. */
export async function fetchClientes(): Promise<Cliente[]> {
  if (!SHEETS_EXPORT_URL) {
    return mockClientes;
  }

  let csv: string;
  try {
    const resposta = await fetch(SHEETS_EXPORT_URL, { cache: "no-store" });
    if (!resposta.ok) {
      throw new Error(`status ${resposta.status}`);
    }
    csv = await resposta.text();
  } catch (erro) {
    throw new Error(
      `Falha ao buscar a planilha de clientes em GOOGLE_SHEETS_EXPORT_URL: ${erro}`,
    );
  }

  const resultado = Papa.parse<LinhaCsv>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (resultado.errors.length > 0) {
    throw new Error(
      `Falha ao interpretar o CSV de clientes: ${resultado.errors[0].message}`,
    );
  }

  return resultado.data
    .filter((linha) => Boolean(linha.cliente_nome))
    .map((linha) => ({
      cliente_nome: (linha.cliente_nome ?? "").trim(),
      consultora_id: (linha.consultora_id ?? "").trim(),
    }));
}
