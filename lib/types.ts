// Tipos compartilhados do dashboard de ATAs de reuniões.

/** Consultora responsável por uma carteira de clientes (tabela Supabase "consultoras"). */
export interface Consultora {
  id: string;
  nome: string;
}

/**
 * Cliente vem do Google Sheets (fonte externa, exportado como CSV), não do Supabase.
 * `cliente_nome` é a chave de ligação com a tabela "reunioes" (Reuniao.cliente_nome).
 * `consultora_id` deve corresponder a um identificador na tabela "consultoras".
 */
export interface Cliente {
  cliente_nome: string;
  consultora_id: string;
}

/**
 * Estado bruto de uma reunião, como fica salvo no Supabase (tabela "reunioes").
 * Fluxo: agendada -> aguardando_ata -> aguardando_edicao -> finalizada
 */
export type StatusReuniao =
  | "agendada"
  | "aguardando_ata"
  | "aguardando_edicao"
  | "finalizada";

// Nomes de coluna conferidos contra o schema real do Supabase do projeto
// (não existe "link_ata": o recebimento da ATA é registrado via e-mail do
// Zoom, com um resumo em texto livre em `resumo_zoom`).
export interface Reuniao {
  id: string;
  cliente_nome: string;
  consultora_id: string | null;
  data_reuniao: string; // data ISO (yyyy-MM-dd) da reunião
  status: StatusReuniao;
  zoom_email_recebido: boolean;
  data_ata_recebida: string | null; // timestamp ISO
  resumo_zoom: string | null;
  arquivo_drive_link: string | null;
  finalizada_em: string | null; // timestamp ISO
  created_at: string;
}

/**
 * Status visual exibido na tabela principal, derivado de `Reuniao.status`
 * combinado com a quantidade de dias desde a última reunião.
 */
export type StatusVisual = "completa" | "aguardando" | "atrasado";

/** Linha calculada exibida na tabela principal: cliente + sua reunião mais relevante. */
export interface LinhaCliente {
  cliente: Cliente;
  ultimaReuniao: Reuniao | null; // reunião mais recente já ocorrida
  proximaReuniao: Reuniao | null; // próxima reunião agendada (futura)
  diasDesdeUltimaReuniao: number | null;
  statusVisual: StatusVisual;
}

/**
 * Horário fixo/recorrente de reunião de um cliente (tabela Supabase "agendamentos_fixos").
 * `dia_semana` vem em português (ex.: "segunda", "terça", ... "sábado", "domingo").
 */
export interface AgendamentoFixo {
  id: string;
  cliente_nome: string;
  consultora_id: string | null;
  dia_semana: string;
  horario: string; // "HH:MM:SS"
  email_cliente: string | null;
}

/** Status de compliance semanal de um agendamento fixo. */
export type StatusSemana = "marcada" | "faltando";

/** Linha calculada da tabela de Agendamentos Fixos. */
export interface LinhaAgendamentoFixo {
  agendamento: AgendamentoFixo;
  proximaOcorrencia: string; // data ISO (yyyy-MM-dd) da próxima ocorrência do dia fixo
  statusSemana: StatusSemana;
}
