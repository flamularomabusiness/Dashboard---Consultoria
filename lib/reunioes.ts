// Operações de escrita na tabela "reunioes" + helpers usados pelos modais de CRUD.
import { supabase } from "@/lib/supabase";
import type { Reuniao } from "@/lib/types";

export type CamposReuniao = Partial<Omit<Reuniao, "id" | "created_at">>;

function cliente() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

/** Erros do Supabase (PostgrestError) não são `Error` — a mensagem fica em `.message`. */
export function mensagemDeErro(erro: unknown): string {
  if (erro && typeof erro === "object" && "message" in erro) {
    return String((erro as { message: unknown }).message);
  }
  return "erro desconhecido";
}

/**
 * Com RLS, UPDATE/DELETE sem policy permitindo não dão erro: simplesmente
 * afetam 0 linhas. Por isso pedimos as linhas de volta (`.select()`) e tratamos
 * "0 linhas" como falha — senão a UI mostraria "sucesso" sem nada ter mudado.
 */
export async function atualizarReuniao(id: string, dados: CamposReuniao): Promise<Reuniao> {
  const { data, error } = await cliente().from("reunioes").update(dados).eq("id", id).select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Nenhuma linha atualizada (a reunião não existe mais ou falta policy de UPDATE no Supabase).",
    );
  }
  return data[0] as Reuniao;
}

export async function deletarReuniao(id: string): Promise<void> {
  const { data, error } = await cliente().from("reunioes").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Nenhuma linha deletada (a reunião não existe mais ou falta policy de DELETE no Supabase).",
    );
  }
}

/** Últimas `limite` reuniões do cliente (inclui as futuras), da mais recente pra mais antiga. */
export function historicoDoCliente(
  reunioes: Reuniao[],
  clienteNome: string,
  limite = 3,
): Reuniao[] {
  return reunioes
    .filter((r) => r.cliente_nome === clienteNome)
    .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao))
    .slice(0, limite);
}
