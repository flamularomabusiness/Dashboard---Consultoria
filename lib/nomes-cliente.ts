// Casamento de nomes de cliente entre fontes diferentes.
//
// O mesmo cliente aparece com grafias diferentes: a planilha (e `reunioes.cliente_nome`)
// usa um nome como "Auto Abastecedora Conrado", enquanto a plataforma tem a razão
// social completa ("AUTO ABASTECEDORA CONRADO LTDA"). Comparar com `===` falharia
// por maiúsculas, acentos, pontuação e "LTDA".

/** Sufixos societários ignorados ao comparar nomes. */
const SUFIXOS_SOCIETARIOS = /(?:\s+(?:ltda|ltd|me|mei|epp|eireli|ss|sa|s a))+$/;

/** Minúsculas, sem acentos, sem pontuação, espaços colapsados e sem sufixo societário (LTDA, ME, S/A...). */
export function normalizarNome(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(SUFIXOS_SOCIETARIOS, "")
    .trim();
}

/** true se os dois nomes são o mesmo cliente, ignorando caixa, acentos, pontuação e "LTDA". */
export function mesmoCliente(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarNome(a);
  return na !== "" && na === normalizarNome(b);
}
