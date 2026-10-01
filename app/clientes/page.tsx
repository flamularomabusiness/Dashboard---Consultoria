// Página de gestão de clientes: tabela com hover card de detalhes e marcos de
// relacionamento (30 dias / 3 meses de contrato).
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bell, CalendarClock, CheckCircle2, Loader2, UserCog, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/FilterPill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClienteCard } from "@/components/ClienteCard";
import { ClienteModal } from "@/components/ClienteModal";
import { StatsCard } from "@/components/StatsCard";
import { useBusca } from "@/lib/search-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockClientesCRM, mockConsultoras, mockContratos, mockReunioes } from "@/lib/mock-data";
import type { ClienteCRM, Consultora, Contrato, Reuniao, StatusCliente } from "@/lib/types";
import { estaNaSemanaAtual } from "@/lib/utils";
import { calcularProximoMarco } from "@/lib/calcular-marcos";

// Produtos (une ROMA 20 / YMPULS 46) cujos clientes aparecem em /clientes —
// os demais produtos da plataforma de mensalidades (EXTRAS, HOLDING, cursos
// da ROMA 35 etc.) não são consultoria e ficam de fora deste painel.
const PRODUTOS_PERMITIDOS = ["CONSULTORIA FINANCEIRA", "CONSULTORIA GREEN+"];

/**
 * Clientes que devem aparecer no painel: contrato de um dos produtos permitidos
 * (ver PRODUTOS_PERMITIDOS) e status diferente de "INATIVO" — cliente inativo
 * não interessa aqui, só Ativo (e Inadimplente, pra acompanhar cobrança).
 */
function filtrarClientesPermitidos(clientesTodos: ClienteCRM[], contratosTodos: Contrato[]) {
  const idsPermitidos = new Set(
    contratosTodos
      .filter((c) => PRODUTOS_PERMITIDOS.includes(c.produtoNome ?? ""))
      .map((c) => c.cliente_id),
  );
  return clientesTodos.filter((c) => idsPermitidos.has(c.id) && c.status !== "INATIVO");
}

export default function ClientesPage() {
  const { busca } = useBusca();
  const [clientes, setClientes] = React.useState<ClienteCRM[]>([]);
  const [consultoras, setConsultoras] = React.useState<Consultora[]>([]);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);
  const [contratos, setContratos] = React.useState<Contrato[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  const [filtroStatus, setFiltroStatus] = React.useState<StatusCliente | "todos">("todos");
  const [filtroConsultora, setFiltroConsultora] = React.useState("todas");
  const [apenasMarcoHoje, setApenasMarcoHoje] = React.useState(false);

  const [clienteDetalhes, setClienteDetalhes] = React.useState<ClienteCRM | null>(null);
  const [modalAberto, setModalAberto] = React.useState(false);

  React.useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      try {
        if (isSupabaseConfigured && supabase) {
          const [
            { data: clientesData, error: erroClientes },
            { data: consultorasData, error: erroConsultoras },
            { data: reunioesData, error: erroReunioes },
            { data: contratosData, error: erroContratos },
          ] = await Promise.all([
            supabase
              .from("clientes")
              .select("*")
              .neq("status", "INATIVO")
              .order("data_criacao", { ascending: false }),
            supabase.from("consultoras").select("*"),
            supabase.from("reunioes").select("*"),
            // "contratos"/"produtos" são da plataforma de mensalidades (mesmo Supabase),
            // não deste app — é lá que mora `contexto_perfil_cliente`, não em "clientes".
            // !inner + .in(produtos.nome) filtra só contratos de CONSULTORIA FINANCEIRA
            // (ROMA 20) / CONSULTORIA GREEN+ (YMPULS 46) — os únicos produtos que devem
            // aparecer neste painel de clientes.
            supabase
              .from("contratos")
              .select(
                "id,cliente_id,status,contexto_perfil_cliente,consultora_id,produtos!inner(nome)",
              )
              .in("produtos.nome", PRODUTOS_PERMITIDOS),
          ]);
          if (erroClientes || erroConsultoras || erroReunioes || erroContratos) {
            throw erroClientes ?? erroConsultoras ?? erroReunioes ?? erroContratos;
          }
          const contratosPermitidos = (contratosData ?? []).map((c) => ({
            id: c.id,
            cliente_id: c.cliente_id,
            status: c.status,
            contexto_perfil_cliente: c.contexto_perfil_cliente,
            consultora_id: c.consultora_id,
            produtoNome: (c.produtos as unknown as { nome: string } | null)?.nome ?? null,
          }));
          setClientes(filtrarClientesPermitidos(clientesData ?? [], contratosPermitidos));
          setConsultoras(consultorasData ?? []);
          setReunioes(reunioesData ?? []);
          setContratos(contratosPermitidos);
        } else {
          setClientes(filtrarClientesPermitidos(mockClientesCRM, mockContratos));
          setConsultoras(mockConsultoras);
          setReunioes(mockReunioes);
          setContratos(mockContratos);
        }
      } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
        toast.error("Não foi possível carregar os dados reais. Exibindo dados fictícios.");
        setClientes(filtrarClientesPermitidos(mockClientesCRM, mockContratos));
        setConsultoras(mockConsultoras);
        setReunioes(mockReunioes);
        setContratos(mockContratos);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, []);

  function consultoraDoContrato(contrato: Contrato | null): Consultora | null {
    if (!contrato?.consultora_id) return null;
    return consultoras.find((c) => c.id === contrato.consultora_id) ?? null;
  }

  /** Últimas 3 reuniões do cliente (mais recente primeiro), casando por nome. */
  function ultimasReunioesDoCliente(cliente: ClienteCRM): Reuniao[] {
    return reunioes
      .filter((r) => r.cliente_nome === cliente.nome_razao_social)
      .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao))
      .slice(0, 3);
  }

  /**
   * Contrato ativo do cliente (hoje, um cliente tem no máximo um). É dele, não
   * de `cliente.consultora_id` (nunca preenchido pela plataforma), que vem a
   * consultora responsável exibida na tabela e no modal.
   */
  function contratoDoCliente(cliente: ClienteCRM): Contrato | null {
    return (
      contratos.find((c) => c.cliente_id === cliente.id && c.status === "ativo") ??
      contratos.find((c) => c.cliente_id === cliente.id) ??
      null
    );
  }

  const clientesFiltrados = React.useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return clientes.filter((cliente) => {
      if (
        buscaNormalizada &&
        !cliente.nome_razao_social.toLowerCase().includes(buscaNormalizada) &&
        !(cliente.nome_fantasia ?? "").toLowerCase().includes(buscaNormalizada) &&
        !cliente.cpf_cnpj_responsavel.toLowerCase().includes(buscaNormalizada)
      ) {
        return false;
      }
      if (filtroStatus !== "todos" && cliente.status !== filtroStatus) return false;
      if (filtroConsultora !== "todas") {
        const contrato = contratoDoCliente(cliente);
        if (contrato?.consultora_id !== filtroConsultora) return false;
      }
      if (apenasMarcoHoje) {
        const marco = calcularProximoMarco(cliente.data_inicio_contrato);
        if (marco.cor !== "amarelo") return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, contratos, busca, filtroStatus, filtroConsultora, apenasMarcoHoje]);

  function limparFiltros() {
    setFiltroStatus("todos");
    setFiltroConsultora("todas");
    setApenasMarcoHoje(false);
  }

  function abrirDetalhes(cliente: ClienteCRM) {
    setClienteDetalhes(cliente);
    setModalAberto(true);
  }

  // Sempre sobre o total de clientes (antes dos filtros), igual ao resumo da página "/".
  const resumo = React.useMemo(() => {
    const nomesPermitidos = new Set(clientes.map((c) => c.nome_razao_social));
    const consultorasAtribuidas = new Set(
      contratos
        .filter((c) => clientes.some((cliente) => cliente.id === c.cliente_id))
        .map((c) => c.consultora_id)
        .filter((id): id is string => Boolean(id)),
    );
    const reunioesSemana = reunioes.filter(
      (r) => nomesPermitidos.has(r.cliente_nome) && estaNaSemanaAtual(r.data_reuniao),
    ).length;

    return clientes.reduce(
      (acc, cliente) => {
        if (cliente.status === "ATIVO") acc.ativos += 1;
        if (calcularProximoMarco(cliente.data_inicio_contrato).cor === "amarelo") {
          acc.marcosHoje += 1;
        }
        return acc;
      },
      { ativos: 0, marcosHoje: 0, consultoras: consultorasAtribuidas.size, reunioesSemana },
    );
  }, [clientes, contratos, reunioes]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-tight text-heading">Gestão de Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de clientes e marcos de relacionamento
        </p>
      </header>

      {/* Stats cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Clientes Ativos" value={resumo.ativos} icon={CheckCircle2} />
        <StatsCard label="Consultoras" value={resumo.consultoras} icon={UserCog} />
        <StatsCard label="Reuniões Semana" value={resumo.reunioesSemana} icon={CalendarClock} />
        <StatsCard label="Marcos Hoje" value={resumo.marcosHoje} icon={Bell} />
      </section>

      {/* Filtros */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={filtroStatus}
            onValueChange={(valor) => setFiltroStatus(valor as StatusCliente | "todos")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroConsultora} onValueChange={setFiltroConsultora}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Consultora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as consultoras</SelectItem>
              {consultoras.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FilterPill ativo={apenasMarcoHoje} onClick={() => setApenasMarcoHoje((v) => !v)}>
            Marcos hoje
          </FilterPill>
        </div>

        <Button variant="outline" onClick={limparFiltros} className="w-full sm:w-auto">
          <X className="mr-2 size-4" />
          Limpar Filtros
        </Button>
      </section>

      {/* Grid de clientes */}
      {carregando && (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline size-4 animate-spin" />
          Carregando dados...
        </div>
      )}

      {!carregando && clientesFiltrados.length === 0 && (
        <div className="py-10 text-center text-muted-foreground">
          Nenhum cliente encontrado para os filtros selecionados.
        </div>
      )}

      {!carregando && clientesFiltrados.length > 0 && (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {clientesFiltrados.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              consultora={consultoraDoContrato(contratoDoCliente(cliente))}
              ultimasReunioes={ultimasReunioesDoCliente(cliente)}
              onVerDetalhes={() => abrirDetalhes(cliente)}
            />
          ))}
        </section>
      )}

      <footer className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" />
        Total de clientes: {clientesFiltrados.length} de {clientes.length}
      </footer>

      <ClienteModal
        cliente={clienteDetalhes}
        consultora={consultoraDoContrato(clienteDetalhes ? contratoDoCliente(clienteDetalhes) : null)}
        contrato={clienteDetalhes ? contratoDoCliente(clienteDetalhes) : null}
        ultimasReunioes={clienteDetalhes ? ultimasReunioesDoCliente(clienteDetalhes) : []}
        open={modalAberto}
        onOpenChange={setModalAberto}
      />
    </main>
  );
}
