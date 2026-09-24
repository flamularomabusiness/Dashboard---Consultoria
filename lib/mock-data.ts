// Dados fictícios para testar o dashboard antes de conectar Supabase e Google Sheets.
// Cobrem de propósito todos os status visuais (✅ completa, ⏳ aguardando, 🔴 atrasado)
// e casos de filtro (sem reunião esta semana, sem nenhuma reunião registrada).
import { addDays, format, subDays } from "date-fns";
import type {
  AgendamentoFixo,
  AgendamentoFixoSheet,
  Cliente,
  ClienteCRM,
  Consultora,
  Reuniao,
} from "@/lib/types";
import { nomeDiaSemana } from "@/lib/utils";

const hoje = new Date();
const iso = (data: Date) => format(data, "yyyy-MM-dd");

export const mockConsultoras: Consultora[] = [
  { id: "consultora-1", nome: "Ana Paula" },
  { id: "consultora-2", nome: "Beatriz Souza" },
  { id: "consultora-3", nome: "Carla Mendes" },
];

export const mockClientes: Cliente[] = [
  { cliente_nome: "Ótica Visão Clara", consultora_id: "consultora-1" },
  { cliente_nome: "Padaria Pão Dourado", consultora_id: "consultora-1" },
  { cliente_nome: "Mercado Bom Preço", consultora_id: "consultora-2" },
  { cliente_nome: "Clínica Vida Saudável", consultora_id: "consultora-2" },
  { cliente_nome: "Construtora Alicerce", consultora_id: "consultora-3" },
  { cliente_nome: "Studio Fitness Now", consultora_id: "consultora-3" },
  { cliente_nome: "Advocacia Martins & Silva", consultora_id: "consultora-1" },
  { cliente_nome: "Escola Sementinha", consultora_id: "consultora-2" },
];

// Clientes fictícios da página /clientes (tabela Supabase "clientes"), reaproveitando
// os mesmos nomes de mockClientes/mockReunioes para que a lista de "Últimas Reuniões"
// do hover card já apareça preenchida nos dados de teste.
// Datas de início de contrato variadas de propósito, para exercitar os 3 estados de
// marco (hoje, concluído, pendente) e o caso sem data ainda cadastrada.
export const mockClientesCRM: ClienteCRM[] = [
  {
    id: "cliente-1",
    nome_razao_social: "Ótica Visão Clara",
    cpf_cnpj_responsavel: "12.345.678/0001-90",
    email_responsavel: "contato@oticavisaoclara.com.br",
    status: "ATIVO",
    faturamento_medio: 45000,
    data_criacao: iso(subDays(hoje, 95)),
    data_inicio_contrato: iso(subDays(hoje, 90)), // marco de 3 meses: HOJE
    consultora_id: "consultora-1",
  },
  {
    id: "cliente-2",
    nome_razao_social: "Padaria Pão Dourado",
    cpf_cnpj_responsavel: "23.456.789/0001-01",
    email_responsavel: "financeiro@paodourado.com.br",
    status: "ATIVO",
    faturamento_medio: 28000,
    data_criacao: iso(subDays(hoje, 35)),
    data_inicio_contrato: iso(subDays(hoje, 30)), // marco de 30 dias: HOJE
    consultora_id: "consultora-1",
  },
  {
    id: "cliente-3",
    nome_razao_social: "Mercado Bom Preço",
    cpf_cnpj_responsavel: "34.567.890/0001-12",
    email_responsavel: "adm@mercadobompreco.com.br",
    status: "INADIMPLENTE",
    faturamento_medio: 120000,
    data_criacao: iso(subDays(hoje, 150)),
    data_inicio_contrato: iso(subDays(hoje, 145)), // todos os marcos concluídos
    consultora_id: "consultora-2",
  },
  {
    id: "cliente-4",
    nome_razao_social: "Clínica Vida Saudável",
    cpf_cnpj_responsavel: "45.678.901/0001-23",
    email_responsavel: "recepcao@vidasaudavel.com.br",
    status: "ATIVO",
    faturamento_medio: 62000,
    data_criacao: iso(subDays(hoje, 10)),
    data_inicio_contrato: iso(subDays(hoje, 8)), // marco de 30 dias: pendente
    consultora_id: "consultora-2",
  },
  {
    id: "cliente-5",
    nome_razao_social: "Construtora Alicerce",
    cpf_cnpj_responsavel: "56.789.012/0001-34",
    email_responsavel: "diretoria@alicerceconstrutora.com.br",
    status: "INATIVO",
    faturamento_medio: null,
    data_criacao: iso(hoje),
    data_inicio_contrato: null, // ainda não iniciado
    consultora_id: null,
  },
];

// Horários fixos/recorrentes de 5 clientes, um por dia entre hoje e os próximos
// 4 dias — assim "próxima ocorrência" cai sempre numa data previsível, sem
// depender de qual dia da semana é "hoje" quando o mock é carregado.
export const mockAgendamentosFixos: AgendamentoFixo[] = [
  {
    id: "fixo-1",
    cliente_nome: "Ótica Visão Clara",
    consultora_id: "consultora-1",
    dia_semana: nomeDiaSemana(hoje),
    horario: "09:00:00",
    email_cliente: "otica@email.com",
  },
  {
    id: "fixo-2",
    cliente_nome: "Padaria Pão Dourado",
    consultora_id: "consultora-1",
    dia_semana: nomeDiaSemana(addDays(hoje, 1)),
    horario: "10:00:00",
    email_cliente: "padaria@email.com",
  },
  {
    id: "fixo-3",
    cliente_nome: "Mercado Bom Preço",
    consultora_id: "consultora-2",
    dia_semana: nomeDiaSemana(addDays(hoje, 2)),
    horario: "11:00:00",
    email_cliente: "mercado@email.com",
  },
  {
    id: "fixo-4",
    cliente_nome: "Clínica Vida Saudável",
    consultora_id: "consultora-2",
    dia_semana: nomeDiaSemana(addDays(hoje, 3)),
    horario: "14:00:00",
    email_cliente: "clinica@email.com",
  },
  {
    id: "fixo-5",
    cliente_nome: "Construtora Alicerce",
    consultora_id: "consultora-3",
    dia_semana: nomeDiaSemana(addDays(hoje, 4)),
    horario: "15:00:00",
    email_cliente: "construtora@email.com",
  },
];

// Mesmos agendamentos fixos, no formato "cru" como viriam da planilha do
// Google Sheets (sem id/e-mail do Supabase) — usado como fallback quando
// lib/google-sheets.ts não consegue ler a planilha real.
export const mockAgendamentosFixosSheet: AgendamentoFixoSheet[] = mockAgendamentosFixos.map(
  ({ cliente_nome, consultora_id, dia_semana, horario }) => ({
    cliente_nome,
    consultora_id: consultora_id ?? "",
    dia_semana,
    horario,
  }),
);

export const mockReunioes: Reuniao[] = [
  // Ótica Visão Clara: ATA finalizada há 2 dias -> ✅ completa
  {
    id: "reuniao-1",
    cliente_nome: "Ótica Visão Clara",
    consultora_id: "consultora-1",
    data_reuniao: iso(subDays(hoje, 2)),
    status: "finalizada",
    zoom_email_recebido: true,
    resumo_zoom: "Resumo automático do Zoom - reunião 1",
    data_ata_recebida: iso(subDays(hoje, 1)),
    arquivo_drive_link: "https://drive.google.com/exemplo-final-1",
    finalizada_em: iso(hoje),
    created_at: iso(subDays(hoje, 2)),
  },
  // Padaria Pão Dourado: reunião há 3 dias, ATA ainda não chegou -> 📁 pendente_drive
  {
    id: "reuniao-2",
    cliente_nome: "Padaria Pão Dourado",
    consultora_id: "consultora-1",
    data_reuniao: iso(subDays(hoje, 3)),
    status: "agendada",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(subDays(hoje, 3)),
  },
  // Mercado Bom Preço: reunião há 10 dias, sem ATA -> 🔴 atrasado
  {
    id: "reuniao-3",
    cliente_nome: "Mercado Bom Preço",
    consultora_id: "consultora-2",
    data_reuniao: iso(subDays(hoje, 10)),
    status: "agendada",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(subDays(hoje, 10)),
  },
  // Clínica Vida Saudável: ATA recebida há 1 dia, pendente Drive -> 📁 pendente_drive
  {
    id: "reuniao-4",
    cliente_nome: "Clínica Vida Saudável",
    consultora_id: "consultora-2",
    data_reuniao: iso(subDays(hoje, 4)),
    status: "pendente_drive",
    zoom_email_recebido: true,
    resumo_zoom: "Resumo automático do Zoom - reunião 4",
    data_ata_recebida: iso(subDays(hoje, 1)),
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(subDays(hoje, 4)),
  },
  // Construtora Alicerce: nenhuma reunião registrada ainda -> 🔴 atrasado
  // (sem entrada em mockReunioes)

  // Studio Fitness Now: ATA finalizada há 20 dias, próxima reunião agendada para dentro de 2 dias
  {
    id: "reuniao-5",
    cliente_nome: "Studio Fitness Now",
    consultora_id: "consultora-3",
    data_reuniao: iso(subDays(hoje, 20)),
    status: "finalizada",
    zoom_email_recebido: true,
    resumo_zoom: "Resumo automático do Zoom - reunião 5",
    data_ata_recebida: iso(subDays(hoje, 19)),
    arquivo_drive_link: "https://drive.google.com/exemplo-final-5",
    finalizada_em: iso(subDays(hoje, 18)),
    created_at: iso(subDays(hoje, 20)),
  },
  {
    id: "reuniao-6",
    cliente_nome: "Studio Fitness Now",
    consultora_id: "consultora-3",
    data_reuniao: iso(addDays(hoje, 2)),
    status: "agendada",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(hoje),
  },
  // Advocacia Martins & Silva: reunião agendada só para dentro de 15 dias,
  // sem reunião anterior -> 🔴 atrasado (nunca teve reunião) e fora da semana atual
  {
    id: "reuniao-7",
    cliente_nome: "Advocacia Martins & Silva",
    consultora_id: "consultora-1",
    data_reuniao: iso(addDays(hoje, 15)),
    status: "agendada",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(hoje),
  },
  // Escola Sementinha: reunião ontem, ainda dentro do prazo -> 📁 pendente_drive
  {
    id: "reuniao-8",
    cliente_nome: "Escola Sementinha",
    consultora_id: "consultora-2",
    data_reuniao: iso(subDays(hoje, 1)),
    status: "agendada",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(subDays(hoje, 1)),
  },
  // Padaria Pão Dourado: já tem uma reunião marcada para a próxima ocorrência
  // do agendamento fixo (fixo-2) -> demonstra o status "✅ Marcada".
  {
    id: "reuniao-9",
    cliente_nome: "Padaria Pão Dourado",
    consultora_id: "consultora-1",
    data_reuniao: iso(addDays(hoje, 1)),
    status: "agendada",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(hoje),
  },
];
