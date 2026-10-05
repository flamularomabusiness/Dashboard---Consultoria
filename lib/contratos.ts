// Edição dos dados do cliente que moram em "contratos" (consultora, conselheiro e
// perfil/contexto). Passa pela função atualizar_contrato_insight do Supabase em vez
// de um UPDATE direto: a tabela tem valores financeiros e a chave anon é pública,
// então a função só aceita alterar esses três campos (ver supabase/schema.sql).
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
      throw new Error(
        "A função atualizar_contrato_insight não existe no Supabase — rode o SQL de supabase/schema.sql.",
      );
    }
    throw error;
  }
  if (data !== true) throw new Error("Contrato não encontrado.");
}
