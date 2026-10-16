// Página de gestão de clientes: tabela com hover card de detalhes e marcos de
// relacionamento (30 dias / 3 meses de contrato).
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bell, CalendarClock, CheckCircle2, Loader2, UserCog, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FilterPill } from "@/components/FilterPill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuscaClientes } from "@/components/BuscaClientes";
import { ClienteCard } from "@/components/ClienteCard";
import { ClienteModal } from "@/components/ClienteModal";
import { EditClienteModal } from "@/components/EditClienteModal";
import { StatsCard } from "@/components/StatsCard";
import { atualizarContratoInsight, type CamposContratoInsight } from "@/lib/contratos";
import { clienteCombinaComBusca } from "@/lib/busca-clientes";
import { useBusca } from "@/lib/search-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { clienteEstaInativo, type ClienteCRM, type Consultora, type Contrato, type Reuniao, type StatusCliente } from "@/lib/types";
import { mesmoCliente, normalizarNome } from "@/lib/nomes-cliente";
import { estaNaSemanaAtual } from "@/lib/utils";
import { calcularProximoMarco } from "@/lib/calcular-marcos";

// Produtos (une ROMA 20 / YMPULS 46) cujos clientes aparecem em /clientes —
// os demais produtos da plataforma de mensalidades (EXTRAS, HOLDING, cursos
// da ROMA 35 etc.) não são consultoria e ficam de fora deste painel.
const PRODUTOS_PERMITIDOS = ["CONSULTORIA FINANCEIRA", "CONSULTORIA GREEN+"];

// Colunas das views do dashboard (nada de select *; faturamento_medio só vem preenchido para admin).
const COLUNAS_DASH_CLIENTES =
  "id,nome_razao_social,nome_fantasia,cpf_cnpj_responsavel,email_responsavel,status,ativo,data_inicio_contrato,data_criacao,faturamento_medio";
const COLUNAS_DASH_CONTRATOS =
  "id,cliente_id,status,contexto_perfil_cliente,consultora_id,conselheiro,produto_nome";

/**
 * Clientes que podem aparecer no painel: contrato de um dos produtos permitidos
 * (ver PRODUTOS_PERMITIDOS). Os inativos (status INATIVO ou ativo = false) ficam
 * escondidos por padrão na tela, com a opção "Mostrar inativos".
 */
function filtrarClientesPermitidos(clientesTodos: ClienteCRM[], contratosTodos: Contrato[]) {
  const idsPermitidos = new Set(
    contratosTodos
      .filter((c) => PRODUTOS_PERMITIDOS.includes(c.produtoNome ?? ""))
      .map((c) => c.cliente_id),
  );
  return clientesTodos.filter((c) => idsPermitidos.has(c.id));
}

export default function ClientesPage() {
  const { busca, setBusca } = useBusca();
  const [clientes, setClientes] = React.useState<ClienteCRM[]>([]);
  const [consultoras, setConsultoras] = React.useState<Consultora[]>([]);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);
  const [contratos, setContratos] = React.useState<Contrato[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erroCarga, setErroCarga] = React.useState<string | null>(null);

  const [filtroStatus, setFiltroStatus] = React.useState<StatusCliente | "todos">("todos");
  const [filtroConsultora, setFiltroConsultora] = React.useState("todas");
  const [apenasMarcoHoje, setApenasMarcoHoje] = React.useState(false);
  const [mostrarInativos, setMostrarInativos] = React.useState(false);

  const [clienteDetalhes, setClienteDetalhes] = React.useState<ClienteCRM | null>(null);
  const [modalAberto, setModalAberto] = React.useState(false);
  const [edicaoClienteId, setEdicaoClienteId] = React.useState<string | null>(null);

  /**
   * Lê as views dash_clientes e dash_contratos (já filtradas por permissão no banco:
   * admin vê tudo, consultora só os clientes e contratos dela) + consultoras e reuniões.
   * Nunca as tabelas clientes/contratos. SEM fallback fictício: se alguma consulta
   * falha, a tela diz qual e oferece "Tentar novamente".
   */
  const carregarDados = React.useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCarregando(true);
      setErroCarga(null);
    }
    try {
      if (!isSupabaseConfigured || !supabase) {
        setErroCarga("Não foi possível carregar os dados: o Supabase não está configurado.");
        return;
      }

      const [rClientes, rConsultoras, rReunioes, rContratos] = await Promise.all([
        supabase
          .from("dash_clientes")
          .select(COLUNAS_DASH_CLIENTES)
          .order("data_criacao", { ascending: false }),
        supabase.from("consultoras").select("*"),
        supabase.from("reunioes").select("*"),
        // dash_contratos já traz o nome do produto em `produto_nome` (sem embed).
        // O filtro mantém só CONSULTORIA FINANCEIRA (ROMA 20) / CONSULTORIA GREEN+
        // (YMPULS 46) — os únicos produtos que devem aparecer neste painel.
        supabase
          .from("dash_contratos")
          .select(COLUNAS_DASH_CONTRATOS)
          .in("produto_nome", PRODUTOS_PERMITIDOS),
      ]);

      // Cada consulta é conferida separada para dizer QUAL falhou (detalhe técnico só no console).
      const falhas: string[] = [];
      if (rClientes.error) {
        console.error("Erro ao carregar clientes:", rClientes.error);
        falhas.push("clientes");
      }
      if (rConsultoras.error) {
        console.error("Erro ao carregar consultoras:", rConsultoras.error);
        falhas.push("consultoras");
      }
      if (rReunioes.error) {
        console.error("Erro ao carregar reuniões:", rReunioes.error);
        falhas.push("reuniões");
      }
      if (rContratos.error) {
        console.error("Erro ao carregar contratos:", rContratos.error);
        falhas.push("contratos");
      }
      if (falhas.length > 0) {
        setErroCarga(`Não foi possível carregar: ${falhas.join(", ")}.`);
        return;
      }
      setErroCarga(null);

      const contratosPermitidos: Contrato[] = (rContratos.data ?? []).map((c) => ({
        id: c.id,
        cliente_id: c.cliente_id,
        status: c.status,
        contexto_perfil_cliente: c.contexto_perfil_cliente,
        consultora_id: c.consultora_id,
        conselheiro: c.conselheiro ?? null,
        produtoNome: c.produto_nome ?? null,
      }));
      setClientes(filtrarClientesPermitidos((rClientes.data ?? []) as ClienteCRM[], contratosPermitidos));
      setConsultoras((rConsultoras.data ?? []) as Consultora[]);
      setReunioes((rReunioes.data ?? []) as Reuniao[]);
      setContratos(contratosPermitidos);
    } catch (erro) {
      console.error("Erro ao carregar clientes:", erro);
      setErroCarga("Não foi possível carregar os dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial (a tela já nasce em "carregando"). Adiada com setTimeout para o estado
  // não ser atualizado de forma síncrona dentro do efeito.
  React.useEffect(() => {
    const id = setTimeout(() => void carregarDados(true), 0);
    return () => clearTimeout(id);
  }, [carregarDados]);

  function consultoraDoContrato(contrato: Contrato | null): Consultora | null {
    if (!contrato?.consultora_id) return null;
    return consultoras.find((c) => c.id === contrato.consultora_id) ?? null;
  }

  /** Últimas 3 reuniões do cliente (mais recente primeiro), casando por nome. */
  function ultimasReunioesDoCliente(cliente: ClienteCRM): Reuniao[] {
    return reunioes
      // cancelada (cliente inativado) não é uma reunião que aconteceu
      .filter((r) => r.status !== "cancelada" && mesmoCliente(r.cliente_nome, cliente.nome_razao_social))
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

  // Universo antes dos demais filtros: sem os inativos (padrão), a menos que "Mostrar inativos"
  // esteja marcado ou o filtro de status seja INATIVO (aí só eles aparecem).
  const universo = React.useMemo(
    () =>
      clientes.filter((c) =>
        filtroStatus === "INATIVO" ? clienteEstaInativo(c) : mostrarInativos || !clienteEstaInativo(c),
      ),
    [clientes, filtroStatus, mostrarInativos],
  );

  const clientesFiltrados = React.useMemo(() => {
    return universo.filter((cliente) => {
      if (!clienteCombinaComBusca(cliente, busca)) return false;
      if (filtroStatus !== "todos" && filtroStatus !== "INATIVO" && cliente.status !== filtroStatus) {
        return false;
      }
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
  }, [universo, contratos, busca, filtroStatus, filtroConsultora, apenasMarcoHoje]);

  function limparFiltros() {
    setFiltroStatus("todos");
    setFiltroConsultora("todas");
    setApenasMarcoHoje(false);
    setMostrarInativos(false);
    setBusca("");
  }

  function abrirDetalhes(cliente: ClienteCRM) {
    setClienteDetalhes(cliente);
    setModalAberto(true);
  }

  const clienteEdicao = clientes.find((c) => c.id === edicaoClienteId) ?? null;
  const clienteDetalhesAtual = clientes.find((c) => c.id === clienteDetalhes?.id) ?? null;

  /**
   * Salva pela RPC (que valida a permissão no banco; se falhar, o erro em português vai
   * para o toast do modal) e RECARREGA os dados: trocar a responsável também move o
   * agendamento fixo e as reuniões futuras, e a consultora que perdeu o cliente deixa de vê-lo.
   */
  async function salvarDadosCliente(contratoId: string, campos: CamposContratoInsight) {
    await atualizarContratoInsight(contratoId, campos);
    toast.success("Dados do cliente atualizados");
    await carregarDados(true);
  }

  // Sempre sobre os clientes ativos (antes dos filtros), igual ao resumo da página "/".
  const resumo = React.useMemo(() => {
    const clientesAtivos = clientes.filter((c) => !clienteEstaInativo(c));
    const nomesPermitidos = new Set(clientesAtivos.map((c) => normalizarNome(c.nome_razao_social)));
    const consultorasAtribuidas = new Set(
      contratos
        .filter((c) => clientesAtivos.some((cliente) => cliente.id === c.cliente_id))
        .map((c) => c.consultora_id)
        .filter((id): id is string => Boolean(id)),
    );
    const reunioesSemana = reunioes.filter(
      (r) =>
        r.status !== "cancelada" &&
        nomesPermitidos.has(normalizarNome(r.cliente_nome)) &&
        estaNaSemanaAtual(r.data_reuniao),
    ).length;

    return clientesAtivos.reduce(
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

  if (erroCarga && !carregando) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-tight text-heading">Gestão de Clientes</h1>
        </header>
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 p-6"
        >
          <p className="font-semibold text-destructive">Não foi possível carregar os dados</p>
          <p className="text-sm text-muted-foreground">{erroCarga}</p>
          <Button onClick={() => void carregarDados()}>Tentar novamente</Button>
        </div>
      </main>
    );
  }

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
          <BuscaClientes
            valor={busca}
            onChange={setBusca}
            exibidos={clientesFiltrados.length}
            total={universo.length}
          />

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
              <SelectItem value="INATIVO">Inativo</SelectItem>
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

          <div className="flex items-center gap-2">
            <Checkbox
              id="mostrar-inativos"
              checked={mostrarInativos || filtroStatus === "INATIVO"}
              disabled={filtroStatus === "INATIVO"}
              onCheckedChange={(valor) => setMostrarInativos(valor === true)}
            />
            <Label htmlFor="mostrar-inativos" className="cursor-pointer font-normal">
              Mostrar inativos
            </Label>
          </div>
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
        <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
          {busca.trim() ? (
            <>
              <p>Nenhum cliente encontrado para &lsquo;{busca.trim()}&rsquo;</p>
              <Button variant="outline" size="sm" onClick={() => setBusca("")}>
                <X className="mr-2 size-4" />
                Limpar busca
              </Button>
            </>
          ) : (
            <p>Nenhum cliente encontrado para os filtros selecionados.</p>
          )}
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
              onEditar={() => setEdicaoClienteId(cliente.id)}
            />
          ))}
        </section>
      )}

      <ClienteModal
        cliente={clienteDetalhesAtual}
        consultora={consultoraDoContrato(clienteDetalhesAtual ? contratoDoCliente(clienteDetalhesAtual) : null)}
        contrato={clienteDetalhesAtual ? contratoDoCliente(clienteDetalhesAtual) : null}
        ultimasReunioes={clienteDetalhesAtual ? ultimasReunioesDoCliente(clienteDetalhesAtual) : []}
        open={modalAberto}
        onOpenChange={setModalAberto}
        onEditar={() => clienteDetalhesAtual && setEdicaoClienteId(clienteDetalhesAtual.id)}
      />

      <EditClienteModal
        cliente={clienteEdicao}
        contrato={clienteEdicao ? contratoDoCliente(clienteEdicao) : null}
        consultoras={consultoras}
        open={clienteEdicao !== null}
        onOpenChange={(open) => !open && setEdicaoClienteId(null)}
        onSalvar={salvarDadosCliente}
      />
    </main>
  );
}
