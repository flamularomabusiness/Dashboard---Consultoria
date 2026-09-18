// Dados fictícios para testar o dashboard antes de conectar Supabase e Google Sheets.
// Cobrem de propósito todos os status visuais (✅ completa, ⏳ aguardando, 🔴 atrasado)
// e casos de filtro (sem reunião esta semana, sem nenhuma reunião registrada).
import { addDays, format, subDays } from "date-fns";
import type {
  AgendamentoFixo,
  AgendamentoFixoSheet,
  Cliente,
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
  // Padaria Pão Dourado: reunião há 3 dias, ATA ainda não chegou -> ⏳ aguardando
  {
    id: "reuniao-2",
    cliente_nome: "Padaria Pão Dourado",
    consultora_id: "consultora-1",
    data_reuniao: iso(subDays(hoje, 3)),
    status: "aguardando_ata",
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
    status: "aguardando_ata",
    zoom_email_recebido: false,
    resumo_zoom: null,
    data_ata_recebida: null,
    arquivo_drive_link: null,
    finalizada_em: null,
    created_at: iso(subDays(hoje, 10)),
  },
  // Clínica Vida Saudável: ATA recebida há 1 dia, aguardando edição -> ⏳ aguardando
  {
    id: "reuniao-4",
    cliente_nome: "Clínica Vida Saudável",
    consultora_id: "consultora-2",
    data_reuniao: iso(subDays(hoje, 4)),
    status: "aguardando_edicao",
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
  // Escola Sementinha: reunião ontem, ainda dentro do prazo -> ⏳ aguardando
  {
    id: "reuniao-8",
    cliente_nome: "Escola Sementinha",
    consultora_id: "consultora-2",
    data_reuniao: iso(subDays(hoje, 1)),
    status: "aguardando_ata",
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
