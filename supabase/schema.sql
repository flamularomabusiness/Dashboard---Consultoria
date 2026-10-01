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
  -- Fluxo: agendada -> pendente_drive (ATA/resumo do Zoom recebido) -> finalizada.
  -- Observação: a tabela já em produção não tem esse check constraint de fato
  -- (confirmado via API em 2026-09-18) — ele é só documentação/aspiracional
  -- para quem rodar este script do zero num projeto novo.
  status text not null default 'agendada'
    check (status in ('agendada', 'pendente_drive', 'finalizada')),
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

-- Cadastro comercial/contratual de clientes, usado pela página /clientes.
-- Documentado a partir da descrição do schema já existente no Supabase (2026-09-24) —
-- não confundir com a lista de clientes do Google Sheets usada no dashboard de reuniões
-- (tabela "reunioes.cliente_nome"), que não tem chave em comum com esta tabela ainda.
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome_razao_social text not null,
  nome_fantasia text,
  cpf_cnpj_responsavel text,
  email_responsavel text,
  status text not null default 'ATIVO'
    check (status in ('ATIVO', 'INATIVO', 'INADIMPLENTE')),
  faturamento_medio numeric,
  data_criacao timestamptz not null default now(),
  -- Podem ficar vazios até o onboarding do cliente ser concluído.
  data_inicio_contrato date,
  -- NÃO USADA pelo app (nunca preenchida pela plataforma de mensalidades) — a
  -- consultora responsável exibida em /clientes vem, na verdade, de
  -- contratos.consultora_id (ver comentário abaixo). Descoberto em 2026-09-28,
  -- junto com o perfil_contexto abaixo.
  consultora_id text references consultoras (id) on delete set null,
  -- NÃO USADA pelo app (deixada aqui só porque já existe na tabela real) — o
  -- texto de "Perfil / Contexto" exibido em /clientes vem, na verdade, de
  -- contratos.contexto_perfil_cliente (ver comentário abaixo). Descoberto em
  -- 2026-09-28: essa coluna foi criada por engano, achando que era aqui que a
  -- plataforma de mensalidades salvava o campo "Contexto e Perfil do Cliente".
  perfil_contexto text
);

-- As duas tabelas abaixo (contratos, produtos) pertencem à plataforma de
-- mensalidades GRUPO ROMABC, não a este app — só documentando aqui as colunas
-- que /clientes lê de lá (mesmo projeto Supabase, tabelas já existentes,
-- conferido via REST API em 2026-09-28). Não rode "create table" para elas.
--
-- contratos (relevante pra este app):
--   id uuid, cliente_id uuid references clientes(id), status text,
--   contexto_perfil_cliente text  -- é AQUI que fica o texto de "Contexto e
--     Perfil do Cliente" que a plataforma de mensalidades edita.
--   consultora_id uuid  -- é AQUI (não em clientes.consultora_id) que fica a
--     consultora responsável — mesmos ids da tabela "consultoras" deste app,
--     sem FK declarada entre as duas (tabelas de projetos diferentes).
--   produto_id uuid references produtos(id)
--
-- produtos (relevante pra este app):
--   id uuid, nome text  -- ex.: "CONSULTORIA FINANCEIRA", exibido como rótulo
--     acima do texto de contexto no modal de detalhes.

-- Dados iniciais de exemplo (opcional) — ajuste os ids para bater com os
-- valores de consultora_id usados na sua planilha de clientes.
insert into consultoras (id, nome) values
  ('elisa', 'Elisa'),
  ('glaucia', 'Glaucia'),
  ('rosane', 'Rosane')
on conflict (id) do nothing;
