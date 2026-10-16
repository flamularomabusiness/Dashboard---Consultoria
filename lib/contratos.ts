// Edição dos dados do cliente que moram em "contratos" (consultora responsável,
// conselheiro e perfil/contexto), sempre pela função atualizar_contrato_insight do
// Supabase (nunca UPDATE direto: a tabela tem valores financeiros).
//
// A função valida a permissão NO BANCO: admin edita qualquer contrato; consultora só
// os contratos em que é a responsável, e pode trocar a responsável por outra consultora
// existente (não pode deixar vazio nem assumir contrato sem responsável). Trocar a
// responsável também move o agendamento fixo e as reuniões futuras do cliente.
// Os erros vêm em português em `error.message` — é essa mensagem que o usuário vê.
import { supabase } from "@/lib/supabase";

export interface CamposContratoInsight {
  consultora_id?: string | null;
  conselheiro?: string;
  contexto_perfil_cliente?: string;
}

export async function atualizarContratoInsight(
  contratoId: string,
  campos: CamposContratoInsight,
): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase.rpc("atualizar_contrato_insight", {
    p_contrato_id: contratoId,
    p_campos: campos,
  });

  if (error) {
    if (error.code === "PGRST202") {
      throw new Error("A função atualizar_contrato_insight não existe no Supabase.");
    }
    throw new Error(error.message || "Não foi possível salvar os dados do cliente.");
  }
  // A função devolve false quando o contrato não existe (ou não é visível para o usuário).
  if (data === false) throw new Error("Contrato não encontrado.");
}
