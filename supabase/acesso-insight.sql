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
