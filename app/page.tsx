// Dashboard principal: tabela de clientes, filtros e ações de reunião/ATA.
"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterPill } from "@/components/FilterPill";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ReuniaoModal, type ReuniaoModalMode } from "@/components/ReuniaoModal";
import { DeleteReuniaoDialog } from "@/components/DeleteReuniaoDialog";
import { EditReuniaoModal } from "@/components/EditReuniaoModal";
import { RemarcarReuniaoModal } from "@/components/RemarcarReuniaoModal";
import { ReuniaoDetalhesModal } from "@/components/ReuniaoDetalhesModal";
import {
  atualizarReuniao,
  deletarReuniao,
  historicoDoCliente,
  type CamposReuniao,
} from "@/lib/reunioes";
import { useBusca } from "@/lib/search-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { syncAgendamentosFixosToReunioes } from "@/lib/sync-reunioes";
import {
  mockAgendamentosFixos,
  mockAgendamentosFixosSheet,
  mockClientes,
  mockConsultoras,
  mockReunioes,
} from "@/lib/mock-data";
import type {
  AgendamentoFixo,
  AgendamentoFixoSheet,
  Cliente,
  Consultora,
  LinhaAgendamentoFixo,
  LinhaCliente,
  Reuniao,
  StatusReuniao,
  StatusVisual,
} from "@/lib/types";
import {
  calcularStatusVisual,
  diasDesde,
  estaNaSemanaAtual,
  formatarData,
  planejarSincronizacaoAgendamentos,
  proximaOcorrenciaDiaSemana,
  resolverConsultoraId,
  separarUltimaEProximaReuniao,
} from "@/lib/utils";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";

interface ModalState {
  open: boolean;
  mode: ReuniaoModalMode;
  clienteNome: string;
  reuniaoId: string | null;
}

export default function DashboardPage() {
  const { busca } = useBusca();
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [consultoras, setConsultoras] = React.useState<Consultora[]>([]);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);
  const [agendamentosFixos, setAgendamentosFixos] = React.useState<AgendamentoFixo[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  const [filtroConsultora, setFiltroConsultora] = React.useState("todas");
  const [filtroStatus, setFiltroStatus] = React.useState<StatusVisual | "todos">("todos");
  const [apenasSemReuniaoSemana, setApenasSemReuniaoSemana] = React.useState(false);
  const [apenasFaltandoSemana, setApenasFaltandoSemana] = React.useState(false);
  const [apenasAtrasados, setApenasAtrasados] = React.useState(false);
  const [apenasFaltando, setApenasFaltando] = React.useState(false);

  const [modal, setModal] = React.useState<ModalState>({
    open: false,
    mode: "agendar",
    clienteNome: "",
    reuniaoId: null,
  });

  // Modais de CRUD guardam só o id: a reunião é lida do estado `reunioes`, então
  // edições aparecem na hora e uma reunião deletada fecha o modal sozinha.
  const [detalhesId, setDetalhesId] = React.useState<string | null>(null);
  const [edicaoId, setEdicaoId] = React.useState<string | null>(null);
  const [remarcarId, setRemarcarId] = React.useState<string | null>(null);
  const [exclusaoId, setExclusaoId] = React.useState<string | null>(null);
  const reuniaoPorId = (id: string | null) => reunioes.find((r) => r.id === id) ?? null;
  const reuniaoDetalhes = reuniaoPorId(detalhesId);

  /**
   * Compara os agendamentos fixos da planilha com os do Supabase e grava lá
   * o que estiver faltando ou desatualizado. Só roda com Supabase configurado
   * (sem ele não há onde persistir a sincronização) — o chamador também só
   * invoca esta função quando `daSheet` veio mesmo da planilha real (nunca com
   * fallback fictício), para nunca gravar dados de teste no Supabase.
   * Retorna a lista final (já refletindo os inserts/updates) para atualizar o
   * estado da tela.
   */
  async function sincronizarAgendamentosComSheets(
    daSheet: AgendamentoFixoSheet[],
    doSupabase: AgendamentoFixo[],
    consultorasCarregadas: Consultora[],
  ): Promise<AgendamentoFixo[]> {
    if (!isSupabaseConfigured || !supabase) return doSupabase;

    const plano = planejarSincronizacaoAgendamentos(daSheet, doSupabase);

    for (const item of plano.paraInserir) {
      const { error } = await supabase.from("agendamentos_fixos").insert({
        cliente_nome: item.cliente_nome,
        // A planilha traz o nome da consultora (ex. "Tainara Muller"), não o
        // id — a coluna é uuid no Supabase, então precisa resolver antes.
        consultora_id: resolverConsultoraId(item.consultora_id, consultorasCarregadas),
        dia_semana: item.dia_semana,
        horario: item.horario,
      });
      if (error) {
        console.error(`[Sync agendamentos_fixos] Erro ao inserir "${item.cliente_nome}":`, error);
      } else {
        console.log(
          `[Sync agendamentos_fixos] INSERT -> ${item.cliente_nome}: ${item.dia_semana} às ${item.horario}`,
        );
      }
    }

    for (const { atual, novo } of plano.paraAtualizar) {
      const { error } = await supabase
        .from("agendamentos_fixos")
        .update({
          dia_semana: novo.dia_semana,
          horario: novo.horario,
          consultora_id: resolverConsultoraId(novo.consultora_id, consultorasCarregadas),
        })
        .eq("id", atual.id);
      if (error) {
        console.error(`[Sync agendamentos_fixos] Erro ao atualizar "${atual.cliente_nome}":`, error);
      } else {
        console.log(
          `[Sync agendamentos_fixos] UPDATE -> ${atual.cliente_nome}: ${atual.dia_semana} ${atual.horario} => ${novo.dia_semana} ${novo.horario}`,
        );
      }
    }

    for (const item of plano.semMudanca) {
      console.log(`[Sync agendamentos_fixos] OK -> ${item.cliente_nome} já sincronizado`);
    }

    if (plano.paraInserir.length === 0 && plano.paraAtualizar.length === 0) {
      return doSupabase;
    }

    const { data: agendamentosAtualizados } = await supabase
      .from("agendamentos_fixos")
      .select("*");
    return agendamentosAtualizados ?? doSupabase;
  }

  // Carrega clientes e agendamentos fixos (Google Sheets, com fallback fictício),
  // consultoras/reuniões (Supabase quando configurado, senão dados fictícios),
  // sincroniza os agendamentos fixos da planilha para dentro do Supabase e, a
  // partir deles, gera as reuniões da semana que ainda não existem.
  React.useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      try {
        const [respostaClientes, respostaAgendamentosSheet] = await Promise.all([
          fetchAutenticado("/api/clientes"),
          fetchAutenticado("/api/agendamentos-fixos"),
        ]);

        const clientesDaSheet: Cliente[] = respostaClientes.ok
          ? await respostaClientes.json()
          : mockClientes;

        const agendamentosSheetPayload: { configurado: boolean; agendamentos: AgendamentoFixoSheet[] } =
          respostaAgendamentosSheet.ok
            ? await respostaAgendamentosSheet.json()
            : { configurado: false, agendamentos: mockAgendamentosFixosSheet };

        if (isSupabaseConfigured && supabase) {
          const [
            { data: consultorasData, error: erroConsultoras },
            { data: reunioesData, error: erroReunioes },
            { data: agendamentosData, error: erroAgendamentos },
          ] = await Promise.all([
            supabase.from("consultoras").select("*"),
            supabase.from("reunioes").select("*"),
            supabase.from("agendamentos_fixos").select("*"),
          ]);
          if (erroConsultoras || erroReunioes || erroAgendamentos) {
            throw erroConsultoras ?? erroReunioes ?? erroAgendamentos;
          }
          const consultorasCarregadas = consultorasData ?? [];
          setConsultoras(consultorasCarregadas);
          // A planilha traz o nome da consultora, não o id (ver comentário em
          // sincronizarAgendamentosComSheets) — resolve aqui também pra
          // filtro/exibição por consultora funcionarem para esses clientes.
          setClientes(
            clientesDaSheet.map((c) => ({
              ...c,
              consultora_id:
                resolverConsultoraId(c.consultora_id, consultorasCarregadas) ?? c.consultora_id,
            })),
          );

          // Só sincroniza (grava no Supabase) quando a planilha real está
          // configurada — nunca com o fallback fictício de mock-data.ts.
          const agendamentosSincronizados = agendamentosSheetPayload.configurado
            ? await sincronizarAgendamentosComSheets(
                agendamentosSheetPayload.agendamentos,
                agendamentosData ?? [],
                consultorasCarregadas,
              )
            : (agendamentosData ?? []);
          setAgendamentosFixos(agendamentosSincronizados);

          setReunioes(reunioesData ?? []);
          const resultadoSync = await syncAgendamentosFixosToReunioes(
            agendamentosSincronizados,
            reunioesData ?? [],
          );
          if (resultadoSync.inseridas > 0) {
            const { data: reunioesAtualizadas } = await supabase.from("reunioes").select("*");
            setReunioes(reunioesAtualizadas ?? reunioesData ?? []);
          }
        } else {
          setClientes(clientesDaSheet);
          setConsultoras(mockConsultoras);
          setReunioes(mockReunioes);
          setAgendamentosFixos(mockAgendamentosFixos);
        }
      } catch (erro) {
        console.error("Erro ao carregar dados:", erro);
        toast.error("Não foi possível carregar os dados reais. Exibindo dados fictícios.");
        setClientes(mockClientes);
        setConsultoras(mockConsultoras);
        setReunioes(mockReunioes);
        setAgendamentosFixos(mockAgendamentosFixos);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, []);

  // Junta cada cliente (Sheets) com sua reunião mais recente e a próxima agendada (Supabase).
  const linhas = React.useMemo<LinhaCliente[]>(() => {
    const hoje = new Date();
    return clientes.map((cliente) => {
      const reunioesDoCliente = reunioes.filter(
        (r) => r.cliente_nome === cliente.cliente_nome,
      );
      const { ultimaReuniao, proximaReuniao } = separarUltimaEProximaReuniao(
        reunioesDoCliente,
        hoje,
      );
      return {
        cliente,
        ultimaReuniao,
        proximaReuniao,
        diasDesdeUltimaReuniao: diasDesde(ultimaReuniao?.data_reuniao, hoje),
        statusVisual: calcularStatusVisual(ultimaReuniao, hoje),
      };
    });
  }, [clientes, reunioes]);

  const linhasFiltradas = React.useMemo(() => {
    const hoje = new Date();
    const domingoQueVem = addDays(hoje, 7 - hoje.getDay());
    const buscaNormalizada = busca.trim().toLowerCase();
    return linhas.filter((linha) => {
      if (
        buscaNormalizada &&
        !linha.cliente.cliente_nome.toLowerCase().includes(buscaNormalizada) &&
        !nomeConsultora(linha.cliente.consultora_id).toLowerCase().includes(buscaNormalizada)
      ) {
        return false;
      }
      if (filtroConsultora !== "todas" && linha.cliente.consultora_id !== filtroConsultora) {
        return false;
      }
      if (filtroStatus !== "todos" && linha.statusVisual !== filtroStatus) {
        return false;
      }
      if (apenasSemReuniaoSemana) {
        const temReuniaoEstaSemana =
          estaNaSemanaAtual(linha.ultimaReuniao?.data_reuniao, hoje) ||
          estaNaSemanaAtual(linha.proximaReuniao?.data_reuniao, hoje);
        if (temReuniaoEstaSemana) return false;
      }
      const reunioesDoCliente = reunioes.filter(
        (r) => r.cliente_nome === linha.cliente.cliente_nome,
      );
      if (apenasFaltandoSemana) {
        const temFaltandoEstaSemana = reunioesDoCliente.some((r) => {
          const data = parseISO(r.data_reuniao);
          return !isBefore(data, startOfDay(hoje)) && !isBefore(domingoQueVem, data);
        });
        if (!temFaltandoEstaSemana) return false;
      }
      if (apenasAtrasados) {
        const temAtrasada = reunioesDoCliente.some(
          (r) => r.status === "agendada" && isBefore(parseISO(r.data_reuniao), startOfDay(hoje)),
        );
        if (!temAtrasada) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    linhas,
    reunioes,
    consultoras,
    busca,
    filtroConsultora,
    filtroStatus,
    apenasSemReuniaoSemana,
    apenasFaltandoSemana,
    apenasAtrasados,
  ]);

  /**
   * Stats do topo (Completas/Pendente Drive/Atrasadas): contagem direta sobre
   * as reuniões em si, não o resumo por cliente usado nas linhas da tabela
   * (`linha.statusVisual`, que olha só a última reunião de cada cliente e
   * perdoa alguns dias antes de marcar como atrasado). Aqui "atrasada" é
   * literal: reunião agendada cuja data já passou.
   */
  const resumo = React.useMemo(() => {
    const hoje = startOfDay(new Date());
    const contagem = reunioes.reduce(
      (acc, r) => {
        if (r.status === "finalizada") acc.completa += 1;
        else if (r.status === "pendente_drive") acc.pendente_drive += 1;
        if (r.status === "agendada" && isBefore(parseISO(r.data_reuniao), hoje)) {
          acc.atrasado += 1;
        }
        return acc;
      },
      { completa: 0, pendente_drive: 0, atrasado: 0 } as Record<StatusVisual, number>,
    );
    const taxaSucesso =
      reunioes.length === 0 ? 0 : Math.round((contagem.completa / reunioes.length) * 100);
    return { ...contagem, taxaSucesso };
  }, [reunioes]);

  // Para cada agendamento fixo, calcula a próxima ocorrência do dia da semana
  // e verifica se já existe uma reunião registrada para essa data -> "Marcada".
  const linhasAgendamentosFixos = React.useMemo<LinhaAgendamentoFixo[]>(() => {
    const hoje = new Date();
    return agendamentosFixos.map((agendamento) => {
      const proximaOcorrencia = format(
        proximaOcorrenciaDiaSemana(agendamento.dia_semana, hoje),
        "yyyy-MM-dd",
      );
      const marcada = reunioes.some(
        (r) =>
          r.cliente_nome === agendamento.cliente_nome &&
          r.data_reuniao === proximaOcorrencia,
      );
      return {
        agendamento,
        proximaOcorrencia,
        statusSemana: marcada ? "marcada" : "faltando",
      };
    });
  }, [agendamentosFixos, reunioes]);

  const linhasAgendamentosFiltradas = React.useMemo(() => {
    if (!apenasFaltando) return linhasAgendamentosFixos;
    return linhasAgendamentosFixos.filter((linha) => linha.statusSemana === "faltando");
  }, [linhasAgendamentosFixos, apenasFaltando]);

  // --- Ações: agendar reunião / registrar ATA recebida / finalizar ---

  async function agendarReuniao(clienteNome: string, data: Date) {
    const consultoraId = clientes.find((c) => c.cliente_nome === clienteNome)?.consultora_id;
    const dataISO = data.toISOString().slice(0, 10);

    const novaReuniao: Reuniao = {
      id: crypto.randomUUID(),
      cliente_nome: clienteNome,
      consultora_id: consultoraId ?? null,
      data_reuniao: dataISO,
      status: "agendada",
      zoom_email_recebido: false,
      data_ata_recebida: null,
      resumo_zoom: null,
      arquivo_drive_link: null,
      finalizada_em: null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data: inserida, error } = await supabase
        .from("reunioes")
        .insert({
          cliente_nome: novaReuniao.cliente_nome,
          consultora_id: novaReuniao.consultora_id,
          data_reuniao: novaReuniao.data_reuniao,
          status: novaReuniao.status,
        })
        .select()
        .single();
      if (error) throw error;
      setReunioes((atual) => [...atual, inserida as Reuniao]);
    } else {
      setReunioes((atual) => [...atual, novaReuniao]);
    }

    toast.success(`Reunião agendada para ${clienteNome}.`);
  }

  /** Grava no Supabase e troca a linha no estado pela versão devolvida pelo banco. */
  async function aplicarAtualizacao(reuniaoId: string, campos: CamposReuniao) {
    const atualizada = await atualizarReuniao(reuniaoId, campos);
    setReunioes((atual) => atual.map((r) => (r.id === reuniaoId ? atualizada : r)));
  }

  async function salvarEdicao(reuniaoId: string, campos: CamposReuniao) {
    await aplicarAtualizacao(reuniaoId, campos);
    toast.success("Reunião atualizada com sucesso");
  }

  async function remarcarReuniao(reuniaoId: string, novaData: string) {
    await aplicarAtualizacao(reuniaoId, { data_reuniao: novaData });
    toast.success(`Reunião remarcada para ${formatarData(novaData)}`);
  }

  async function excluirReuniao(reuniao: Reuniao) {
    await deletarReuniao(reuniao.id);
    setReunioes((atual) => atual.filter((r) => r.id !== reuniao.id));
    if (detalhesId === reuniao.id) setDetalhesId(null);
    toast.success("Reunião deletada com sucesso");
  }

  async function registrarAtaRecebida(reuniaoId: string, resumo: string) {
    const status: StatusReuniao = "pendente_drive";
    await aplicarAtualizacao(reuniaoId, {
      status,
      zoom_email_recebido: true,
      resumo_zoom: resumo || null,
      data_ata_recebida: new Date().toISOString(),
    });
    toast.success("ATA registrada como recebida. Pendente Drive.");
  }

  async function finalizarReuniao(reuniaoId: string, linkDrive: string) {
    const status: StatusReuniao = "finalizada";
    await aplicarAtualizacao(reuniaoId, {
      status,
      arquivo_drive_link: linkDrive,
      finalizada_em: new Date().toISOString(),
    });
    toast.success("Reunião finalizada com sucesso.");
  }

  // --- Controle do modal ---

  function abrirAgendar(clienteNome = "") {
    setModal({ open: true, mode: "agendar", clienteNome, reuniaoId: null });
  }

  function abrirAta(linha: LinhaCliente) {
    const reuniao = reuniaoParaAcao(linha);
    if (!reuniao) return;
    setModal({
      open: true,
      mode: "ata",
      clienteNome: linha.cliente.cliente_nome,
      reuniaoId: reuniao.id,
    });
  }

  function abrirFinalizar(linha: LinhaCliente) {
    const reuniao = reuniaoParaAcao(linha);
    if (!reuniao) return;
    setModal({
      open: true,
      mode: "finalizar",
      clienteNome: linha.cliente.cliente_nome,
      reuniaoId: reuniao.id,
    });
  }

  /** Reunião usada para decidir as ações da linha: a última já realizada ou,
   * na falta dela, a próxima agendada (ainda sem nenhuma reunião concluída). */
  function reuniaoParaAcao(linha: LinhaCliente): Reuniao | null {
    return linha.ultimaReuniao ?? linha.proximaReuniao ?? null;
  }

  /**
   * Ações disponíveis por linha, de acordo com o status da reunião:
   * - agendada (reunião futura ou já ocorrida, ainda sem ATA) -> "ATA Recebida" + "Agendar"
   * - pendente_drive (ATA/resumo do Zoom já recebido)         -> "Finalizar"
   * - finalizada                                              -> "Ver" (link do Drive) ou "-"
   * - sem nenhuma reunião registrada ainda                    -> só "Agendar"
   */
  function acoesDaLinha(linha: LinhaCliente): Array<"agendar" | "ata" | "finalizar" | "ver"> {
    const reuniao = reuniaoParaAcao(linha);
    if (!reuniao) return ["agendar"];

    if (reuniao.status === "agendada") return ["ata", "agendar"];
    if (reuniao.status === "finalizada") return ["ver"];
    return ["finalizar"]; // pendente_drive
  }

  /** A planilha só traz o id da consultora; aqui resolvemos o nome para exibição. */
  function nomeConsultora(consultoraId: string) {
    return consultoras.find((c) => c.id === consultoraId)?.nome ?? consultoraId;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-tight text-heading">Dashboard INSIGHT</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe reuniões, ATAs pendentes e prazos por cliente e consultora.
        </p>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Completas" value={resumo.completa} icon={CheckCircle2} />
        <StatsCard label="Pendente Drive" value={resumo.pendente_drive} icon={FolderOpen} />
        <StatsCard label="Atrasadas" value={resumo.atrasado} icon={AlertCircle} />
        <StatsCard label="Taxa de Sucesso" value={`${resumo.taxaSucesso}%`} icon={TrendingUp} />
      </section>

      {/* Filtros */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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

          <Select
            value={filtroStatus}
            onValueChange={(valor) => setFiltroStatus(valor as StatusVisual | "todos")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="completa">✅ Completa</SelectItem>
              <SelectItem value="pendente_drive">📁 Pendente Drive</SelectItem>
              <SelectItem value="atrasado">🔴 Atrasado</SelectItem>
            </SelectContent>
          </Select>

          <FilterPill
            ativo={apenasSemReuniaoSemana}
            onClick={() => setApenasSemReuniaoSemana((v) => !v)}
          >
            Clientes sem reunião esta semana
          </FilterPill>

          <FilterPill ativo={apenasFaltandoSemana} onClick={() => setApenasFaltandoSemana((v) => !v)}>
            Só faltando esta semana
          </FilterPill>

          <FilterPill ativo={apenasAtrasados} onClick={() => setApenasAtrasados((v) => !v)}>
            Só atrasados
          </FilterPill>
        </div>

        <Button onClick={() => abrirAgendar()} className="w-full sm:w-auto">
          <CalendarPlus className="mr-2 size-4" />
          Nova Reunião
        </Button>
      </section>

      {/* Tabela principal */}
      <section className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Consultora</TableHead>
                <TableHead>Última Reunião</TableHead>
                <TableHead>Dias desde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próxima Reunião</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Carregando dados...
                  </TableCell>
                </TableRow>
              )}

              {!carregando && linhasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}

              {!carregando &&
                linhasFiltradas.map((linha) => {
                  const acoes = acoesDaLinha(linha);
                  const alvo = reuniaoParaAcao(linha);
                  // Só reunião ainda "agendada" pode ser remarcada; a próxima tem prioridade.
                  const alvoRemarcar =
                    [linha.proximaReuniao, linha.ultimaReuniao].find(
                      (r) => r?.status === "agendada",
                    ) ?? null;
                  const totalReunioes = reunioes.filter(
                    (r) => r.cliente_nome === linha.cliente.cliente_nome,
                  ).length;
                  return (
                    <TableRow key={linha.cliente.cliente_nome}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {linha.cliente.cliente_nome}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {nomeConsultora(linha.cliente.consultora_id)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <DataClicavel reuniao={linha.ultimaReuniao} onClick={setDetalhesId} />
                        {totalReunioes > 0 && (
                          <span className="ml-1 text-muted-foreground">({totalReunioes})</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {linha.diasDesdeUltimaReuniao === null
                          ? "Nunca"
                          : `${linha.diasDesdeUltimaReuniao} dia(s)`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={linha.statusVisual} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <DataClicavel reuniao={linha.proximaReuniao} onClick={setDetalhesId} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {acoes.includes("ata") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full hover:border-brand-green hover:text-brand-green"
                              title="Registrar ATA recebida"
                              onClick={() => abrirAta(linha)}
                            >
                              <span aria-hidden="true">📎</span>
                              <span className="hidden 2xl:inline">ATA Recebida</span>
                            </Button>
                          )}
                          {acoes.includes("agendar") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full hover:border-brand-green hover:text-brand-green"
                              title="Agendar reunião"
                              onClick={() => abrirAgendar(linha.cliente.cliente_nome)}
                            >
                              <CalendarPlus className="size-4" />
                              <span className="hidden 2xl:inline">Agendar</span>
                            </Button>
                          )}
                          {acoes.includes("finalizar") && (
                            <Button
                              size="sm"
                              className="rounded-full"
                              title="Finalizar reunião"
                              onClick={() => abrirFinalizar(linha)}
                            >
                              <span aria-hidden="true">✅</span>
                              <span className="hidden 2xl:inline">Finalizar</span>
                            </Button>
                          )}
                          {acoes.includes("ver") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full hover:border-brand-green hover:text-brand-green"
                              title="Ver resumo, arquivo e data"
                              onClick={() => setDetalhesId(reuniaoParaAcao(linha)?.id ?? null)}
                            >
                              <span aria-hidden="true">📁</span>
                              <span className="hidden 2xl:inline">Ver</span>
                            </Button>
                          )}
                          {alvo && (
                            <>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-brand-blue dark:text-blue-400 transition-transform duration-200 hover:scale-105 hover:bg-brand-blue/10 hover:text-brand-blue"
                                title="Editar reunião"
                                aria-label={`Editar reunião de ${linha.cliente.cliente_nome}`}
                                onClick={() => setEdicaoId(alvo.id)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              {alvoRemarcar && (
                                <Button
                                  size="icon-sm"
                                  variant="outline"
                                  className="rounded-full text-brand-green-alt transition-transform duration-200 hover:scale-105 hover:bg-brand-green/10 hover:text-brand-green-alt dark:text-brand-green"
                                  title="Remarcar reunião"
                                  aria-label={`Remarcar reunião de ${linha.cliente.cliente_nome}`}
                                  onClick={() => setRemarcarId(alvoRemarcar.id)}
                                >
                                  <CalendarClock className="size-4" />
                                </Button>
                              )}
                              <Button
                                size="icon-sm"
                                variant="outline"
                                className="rounded-full text-destructive transition-transform duration-200 hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
                                title="Deletar reunião"
                                aria-label={`Deletar reunião de ${linha.cliente.cliente_nome}`}
                                onClick={() => setExclusaoId(alvo.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Agendamentos fixos: compromisso semanal recorrente por cliente */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-heading">Agendamentos Fixos da Semana</h2>
          <p className="text-sm text-muted-foreground">
            Próxima ocorrência de cada horário fixo e se já existe reunião marcada para ela.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="apenas-faltando"
            checked={apenasFaltando}
            onCheckedChange={(valor) => setApenasFaltando(valor === true)}
          />
          <Label htmlFor="apenas-faltando" className="cursor-pointer font-normal">
            Mostrar só faltando
          </Label>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Consultora</TableHead>
                  <TableHead>Dia da Semana</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Próxima Reunião</TableHead>
                  <TableHead>Status da Semana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline size-4 animate-spin" />
                      Carregando dados...
                    </TableCell>
                  </TableRow>
                )}

                {!carregando && linhasAgendamentosFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhum agendamento fixo encontrado para o filtro selecionado.
                    </TableCell>
                  </TableRow>
                )}

                {!carregando &&
                  linhasAgendamentosFiltradas.map((linha) => (
                    <TableRow key={linha.agendamento.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {linha.agendamento.cliente_nome}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {nomeConsultora(linha.agendamento.consultora_id ?? "")}
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">
                        {linha.agendamento.dia_semana}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {linha.agendamento.horario.slice(0, 5)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(linha.proximaOcorrencia)}
                      </TableCell>
                      <TableCell>
                        {linha.statusSemana === "marcada" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-green-300 bg-green-100 font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                          >
                            ✅ Marcada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-red-300 bg-red-100 font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                          >
                            🔴 Faltando
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <ReuniaoModal
        open={modal.open}
        mode={modal.mode}
        onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
        clientes={clientes}
        clienteSelecionado={modal.clienteNome}
        onAgendar={agendarReuniao}
        onAtaRecebida={(link) => registrarAtaRecebida(modal.reuniaoId!, link)}
        onFinalizar={(link) => finalizarReuniao(modal.reuniaoId!, link)}
      />

      <ReuniaoDetalhesModal
        reuniao={reuniaoDetalhes}
        historico={
          reuniaoDetalhes ? historicoDoCliente(reunioes, reuniaoDetalhes.cliente_nome) : []
        }
        consultoraNome={nomeConsultora(reuniaoDetalhes?.consultora_id ?? "")}
        open={reuniaoDetalhes !== null}
        onOpenChange={(open) => !open && setDetalhesId(null)}
        onSelecionar={setDetalhesId}
        onEditar={(r) => setEdicaoId(r.id)}
        onRemarcar={(r) => setRemarcarId(r.id)}
        onDeletar={(r) => setExclusaoId(r.id)}
      />

      <EditReuniaoModal
        reuniao={reuniaoPorId(edicaoId)}
        open={reuniaoPorId(edicaoId) !== null}
        onOpenChange={(open) => !open && setEdicaoId(null)}
        clientes={clientes}
        onSalvar={salvarEdicao}
      />

      <RemarcarReuniaoModal
        reuniao={reuniaoPorId(remarcarId)}
        open={reuniaoPorId(remarcarId) !== null}
        onOpenChange={(open) => !open && setRemarcarId(null)}
        onRemarcar={remarcarReuniao}
      />

      <DeleteReuniaoDialog
        reuniao={reuniaoPorId(exclusaoId)}
        open={reuniaoPorId(exclusaoId) !== null}
        onOpenChange={(open) => !open && setExclusaoId(null)}
        onConfirmar={excluirReuniao}
      />
    </main>
  );
}

/** Data de uma reunião como botão: abre o modal de detalhes daquela reunião. */
function DataClicavel({
  reuniao,
  onClick,
}: {
  reuniao: Reuniao | null;
  onClick: (id: string) => void;
}) {
  if (!reuniao) return <>-</>;
  return (
    <button
      type="button"
      onClick={() => onClick(reuniao.id)}
      title="Ver detalhes da reunião"
      className="cursor-pointer rounded-sm font-medium underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {formatarData(reuniao.data_reuniao)}
    </button>
  );
}
