// Regras puras do cadastro (criar conta): tradução dos erros do Supabase Auth e
// validação do nome completo. Sem dependência de React/Supabase para poder testar.

export const MENSAGEM_EMAIL_NAO_LIBERADO =
  "Este email ainda não foi liberado. Fale com o administrador para autorizar seu acesso.";

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Traduz o erro do `supabase.auth.signUp` para o texto mostrado ao usuário. Só emails
 * de uma lista autorizada criam conta: o gatilho do banco recusa os demais, e o Supabase
 * devolve isso como "Database error saving new user" (ou "Email não autorizado") — a
 * mesma tradução da plataforma de mensalidades.
 */
export function traduzirErroCadastro(mensagem: string): string {
  const m = semAcento(mensagem).toLowerCase();

  if (m.includes("database error saving new user") || m.includes("email nao autorizado")) {
    return MENSAGEM_EMAIL_NAO_LIBERADO;
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Este email já possui conta. Entre com sua senha.";
  }
  if (m.includes("password should be at least") || m.includes("weak password")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Informe um email válido.";
  }
  return "Não foi possível criar a conta. Tente novamente.";
}

/** Tira espaços sobrando: nas pontas e repetidos no meio ("Maria   Silva " -> "Maria Silva"). */
export function normalizarNomeCompleto(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

/** Nome completo válido: no mínimo 3 caracteres depois de tirar os espaços sobrando. */
export function nomeCompletoValido(nome: string): boolean {
  return normalizarNomeCompleto(nome).length >= 3;
}
