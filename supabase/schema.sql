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
-- ---------------------------------------------------------------------------
-- Edição de consultora / conselheiro / perfil-contexto pelo INSIGHT (/clientes)
-- ---------------------------------------------------------------------------
-- "conselheiro" só existe no INSIGHT (a plataforma não usa). Consultora e
-- perfil/contexto são os campos da plataforma: editar no INSIGHT atualiza a
-- mesma linha de contratos que a plataforma lê.
--
-- Em vez de liberar UPDATE na tabela contratos (que guarda valor_mensal etc.),
-- o app chama esta função, que só altera esses três campos (e só os que vierem
-- no JSON) e só para quem passa em tem_acesso_insight().
alter table contratos add column if not exists conselheiro text;

create or replace function atualizar_contrato_insight(p_contrato_id uuid, p_campos jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linhas int;
begin
  if not tem_acesso_insight() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  update contratos
     set consultora_id = case when p_campos ? 'consultora_id'
                              then nullif(p_campos->>'consultora_id', '')::uuid
                              else consultora_id end,
         conselheiro = case when p_campos ? 'conselheiro'
                            then nullif(p_campos->>'conselheiro', '')
                            else conselheiro end,
         contexto_perfil_cliente = case when p_campos ? 'contexto_perfil_cliente'
                                        then coalesce(p_campos->>'contexto_perfil_cliente', '')
                                        else contexto_perfil_cliente end,
         data_atualizacao = now()
   where id = p_contrato_id;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

-- Só quem está logado chama (e a função ainda confere tem_acesso_insight()).
revoke all on function atualizar_contrato_insight(uuid, jsonb) from public, anon;
grant execute on function atualizar_contrato_insight(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Login e controle de acesso do INSIGHT
-- ---------------------------------------------------------------------------
-- Login = Supabase Auth (mesmas contas da plataforma). Estar logado não basta:
-- é preciso ter uma linha ATIVA em `usuarios` (casando por id ou e-mail) com um
-- dos papéis abaixo. Para liberar outro papel, edite a lista em perfil_insight().
create or replace function perfil_insight()
returns table (nome text, role text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.nome, u.role, u.email
    from usuarios u
   where coalesce(u.ativo, false)
     and u.role in ('administrator', 'consultora')
     and (u.id = auth.uid()
          or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
   limit 1;
$$;

create or replace function tem_acesso_insight()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfil_insight());
$$;

revoke all on function perfil_insight() from public, anon;
revoke all on function tem_acesso_insight() from public, anon;
grant execute on function perfil_insight() to authenticated;
grant execute on function tem_acesso_insight() to authenticated;

-- Policies para quem passa em tem_acesso_insight(). São ADITIVAS: não removem as
-- policies antigas (que liberavam o papel anon) — a remoção delas é um passo
-- separado, depois de conferir pg_policies.
drop policy if exists insight_acesso_reunioes on reunioes;
create policy insight_acesso_reunioes on reunioes
  for all to authenticated
  using (tem_acesso_insight()) with check (tem_acesso_insight());

drop policy if exists insight_acesso_agendamentos_fixos on agendamentos_fixos;
create policy insight_acesso_agendamentos_fixos on agendamentos_fixos
  for all to authenticated
  using (tem_acesso_insight()) with check (tem_acesso_insight());

-- Leitura apenas: escrita em contratos passa pela função atualizar_contrato_insight.
drop policy if exists insight_leitura_clientes on clientes;
create policy insight_leitura_clientes on clientes
  for select to authenticated using (tem_acesso_insight());

drop policy if exists insight_leitura_contratos on contratos;
create policy insight_leitura_contratos on contratos
  for select to authenticated using (tem_acesso_insight());

drop policy if exists insight_leitura_produtos on produtos;
create policy insight_leitura_produtos on produtos
  for select to authenticated using (tem_acesso_insight());

drop policy if exists insight_leitura_consultoras on consultoras;
create policy insight_leitura_consultoras on consultoras
  for select to authenticated using (tem_acesso_insight());

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
