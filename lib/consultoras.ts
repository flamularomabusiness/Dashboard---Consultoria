// Quem aparece em cada lista de consultoras, de acordo com `consultoras.tipo`
// ('consultora', 'mentor' ou 'bpo'). A RPC transferir_cliente já recusa no banco um
// destino que não seja 'consultora' quando quem chama não é admin; estas funções só
// evitam OFERECER na tela uma opção que o banco vai recusar.
import type { Consultora } from "@/lib/types";

/** Tipos que o usuário pode escolher como destino/responsável: admin também escolhe mentor. */
function tipoPermitido(c: Consultora, ehAdmin: boolean): boolean {
  return c.tipo === "consultora" || (ehAdmin && c.tipo === "mentor");
}

/** Destinos do "Transferir": tipo 'consultora' (admin: + 'mentor'), menos a responsável atual. */
export function consultorasDestino(
  consultoras: Consultora[],
  ehAdmin: boolean,
  atualId?: string | null,
): Consultora[] {
  return consultoras.filter((c) => c.id !== atualId && tipoPermitido(c, ehAdmin));
}

/**
 * Opções do select "Consultora responsável" do painel de clientes: tipo 'consultora'
 * (admin: + 'mentor'). Se o cliente já está com uma responsável de outro tipo (ex.: bpo),
 * ela continua na lista para o nome seguir visível — ainda que a pessoa não possa escolhê-la
 * de novo depois de trocar.
 */
export function consultorasResponsavel(
  consultoras: Consultora[],
  ehAdmin: boolean,
  atualId?: string | null,
): Consultora[] {
  return consultoras.filter((c) => c.id === atualId || tipoPermitido(c, ehAdmin));
}

/**
 * Filtros "Todas as consultoras": as de tipo 'consultora' e também qualquer responsável
 * que tenha clientes ou reuniões (`idsComDados`) — mentor/bpo com carteira não podem sumir
 * do filtro.
 */
export function consultorasParaFiltro(
  consultoras: Consultora[],
  idsComDados: Iterable<string | null | undefined>,
): Consultora[] {
  const comDados = new Set<string>();
  for (const id of idsComDados) if (id) comDados.add(id);
  return consultoras.filter((c) => c.tipo === "consultora" || comDados.has(c.id));
}
