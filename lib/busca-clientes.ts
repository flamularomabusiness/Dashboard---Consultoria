// Regra de busca da página /clientes (e do campo de busca do header).

/** Minúsculas e sem acentos/diacríticos: "Segurança" casa com "seguranca". */
export function normalizarBusca(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function soDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

/** O termo parece um CNPJ/CPF digitado (só dígitos e pontuação), com ou sem máscara? */
function pareceDocumento(termo: string): boolean {
  return /^[\d.\-/\s]+$/.test(termo) && soDigitos(termo).length > 0;
}

export interface ClienteBuscavel {
  nome_razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj_responsavel: string;
}

/**
 * true se o cliente combina com o termo: razão social ou nome fantasia contendo o
 * texto (sem diferenciar caixa nem acentos) OU, quando o termo é só números e
 * pontuação, CNPJ/CPF contendo os mesmos dígitos (com ou sem máscara). Termo
 * vazio combina com todos. Um termo com letras nunca olha o documento — "loja 2"
 * não pode casar com qualquer CNPJ que tenha um 2.
 */
export function clienteCombinaComBusca(cliente: ClienteBuscavel, termo: string): boolean {
  const alvo = normalizarBusca(termo);
  if (!alvo) return true;

  if (normalizarBusca(cliente.nome_razao_social).includes(alvo)) return true;
  if (normalizarBusca(cliente.nome_fantasia).includes(alvo)) return true;
  if (pareceDocumento(alvo)) {
    return soDigitos(cliente.cpf_cnpj_responsavel).includes(soDigitos(alvo));
  }
  return false;
}
