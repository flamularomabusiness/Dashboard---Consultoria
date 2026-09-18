-- Schema Supabase para o Dashboard de Otimização de ATAs de Reuniões.
--
-- Este arquivo documenta o schema REAL já em uso no projeto (conferido via
-- REST API em 2026-09-17) — não o crie do zero se as tabelas já existem.
-- `consultora_id` aqui é texto livre (ex.: "elisa", "glaucia"), não uma FK
-- para um uuid; garanta que a tabela `consultoras` tenha um identificador
-- compatível (coluna `id` ou similar) para o dashboard resolver o nome.

create table if not exists consultoras (
  id text primary key,
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists reunioes (
  id uuid primary key default gen_random_uuid(),
  -- Nome do cliente, vindo do Google Sheets (não há tabela "clientes" no Supabase).
  cliente_nome text not null,
  consultora_id text references consultoras (id) on delete set null,
  data_reuniao date not null,
  status text not null default 'agendada'
    check (status in ('agendada', 'aguardando_ata', 'aguardando_edicao', 'finalizada')),
  -- ATA recebida via e-mail do Zoom (sem link — apenas confirmação + resumo em texto).
  zoom_email_recebido boolean not null default false,
  data_ata_recebida timestamptz,
  resumo_zoom text,
  -- Arquivo final (Word + PDF) já editado no Drive.
  arquivo_drive_link text,
  finalizada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reunioes_cliente_nome_idx on reunioes (cliente_nome);

-- Horário fixo/recorrente semanal por cliente (ex.: "toda terça às 15h").
-- `dia_semana` em português: domingo, segunda, terça, quarta, quinta, sexta, sábado.
create table if not exists agendamentos_fixos (
  id uuid primary key default gen_random_uuid(),
  cliente_nome text not null,
  consultora_id text references consultoras (id) on delete set null,
  dia_semana text not null,
  horario time not null,
  email_cliente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agendamentos_fixos_cliente_nome_idx on agendamentos_fixos (cliente_nome);

-- Dados iniciais de exemplo (opcional) — ajuste os ids para bater com os
-- valores de consultora_id usados na sua planilha de clientes.
insert into consultoras (id, nome) values
  ('elisa', 'Elisa'),
  ('glaucia', 'Glaucia'),
  ('rosane', 'Rosane')
on conflict (id) do nothing;
