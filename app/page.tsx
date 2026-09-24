// Dashboard principal: tabela de clientes, filtros e ações de reunião/ATA.
"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertCircle, CalendarPlus, CheckCircle2, FolderOpen, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatusBadge } from "@/components/StatusBadge";
import { ReuniaoModal, type ReuniaoModalMode } from "@/components/ReuniaoModal";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
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
  separarUltimaEProximaReuniao,
} from "@/lib/utils";
import { format } from "date-fns";

interface ModalState {
  open: boolean;
  mode: ReuniaoModalMode;
  clienteNome: string;
  reuniaoId: string | null;
}

export default function DashboardPage() {
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [consultoras, setConsultoras] = React.useState<Consultora[]>([]);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);
  const [agendamentosFixos, setAgendamentosFixos] = React.useState<AgendamentoFixo[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  const [filtroConsultora, setFiltroConsultora] = React.useState("todas");
  const [filtroStatus, setFiltroStatus] = React.useState<StatusVisual | "todos">("todos");
  const [apenasSemReuniaoSemana, setApenasSemReuniaoSemana] = React.useState(false);
  const [apenasFaltando, setApenasFaltando] = React.useState(false);

  const [modal, setModal] = React.useState<ModalState>({
    open: false,
    mode: "agendar",
    clienteNome: "",
    reuniaoId: null,
  });

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
  ): Promise<AgendamentoFixo[]> {
    if (!isSupabaseConfigured || !supabase) return doSupabase;

    const plano = planejarSincronizacaoAgendamentos(daSheet, doSupabase);

    for (const item of plano.paraInserir) {
      const { error } = await supabase.from("agendamentos_fixos").insert({
        cliente_nome: item.cliente_nome,
        consultora_id: item.consultora_id || null,
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
          consultora_id: novo.consultora_id || null,
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
  // consultoras/reuniões (Supabase quando configurado, senão dados fictícios) e
  // sincroniza os agendamentos fixos da planilha para dentro do Supabase.
  React.useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      try {
        const [respostaClientes, respostaAgendamentosSheet] = await Promise.all([
          fetch("/api/clientes"),
          fetch("/api/agendamentos-fixos"),
        ]);

        const clientesCarregados: Cliente[] = respostaClientes.ok
          ? await respostaClientes.json()
          : mockClientes;
        setClientes(clientesCarregados);

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
          setConsultoras(consultorasData ?? []);
          setReunioes(reunioesData ?? []);

          // Só sincroniza (grava no Supabase) quando a planilha real está
          // configurada — nunca com o fallback fictício de mock-data.ts.
          const agendamentosSincronizados = agendamentosSheetPayload.configurado
            ? await sincronizarAgendamentosComSheets(
                agendamentosSheetPayload.agendamentos,
                agendamentosData ?? [],
              )
            : (agendamentosData ?? []);
          setAgendamentosFixos(agendamentosSincronizados);
        } else {
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
    return linhas.filter((linha) => {
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
      return true;
    });
  }, [linhas, filtroConsultora, filtroStatus, apenasSemReuniaoSemana]);

  const resumo = React.useMemo(() => {
    return linhas.reduce(
      (acc, linha) => {
        acc[linha.statusVisual] += 1;
        return acc;
      },
      { completa: 0, pendente_drive: 0, atrasado: 0 } as Record<StatusVisual, number>,
    );
  }, [linhas]);

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

  async function atualizarReuniao(reuniaoId: string, campos: Partial<Reuniao>) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("reunioes").update(campos).eq("id", reuniaoId);
      if (error) throw error;
    }
    setReunioes((atual) =>
      atual.map((r) => (r.id === reuniaoId ? { ...r, ...campos } : r)),
    );
  }

  async function registrarAtaRecebida(reuniaoId: string, resumo: string) {
    const status: StatusReuniao = "pendente_drive";
    await atualizarReuniao(reuniaoId, {
      status,
      zoom_email_recebido: true,
      resumo_zoom: resumo || null,
      data_ata_recebida: new Date().toISOString(),
    });
    toast.success("ATA registrada como recebida. Pendente Drive.");
  }

  async function finalizarReuniao(reuniaoId: string, linkDrive: string) {
    const status: StatusReuniao = "finalizada";
    await atualizarReuniao(reuniaoId, {
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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Otimização de ATAs de Reuniões
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe reuniões, ATAs pendentes e prazos por cliente e consultora.
        </p>
      </header>

      {/* Cards de resumo com status visual (verde/amarelo/vermelho) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">
              Completas
            </CardTitle>
            <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-900 dark:text-green-200">
            {resumo.completa}
          </CardContent>
        </Card>

        <Card className="border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-300">
              Pendente Drive
            </CardTitle>
            <FolderOpen className="size-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="text-3xl font-bold text-orange-900 dark:text-orange-200">
            {resumo.pendente_drive}
          </CardContent>
        </Card>

        <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">
              Atrasados
            </CardTitle>
            <AlertCircle className="size-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="text-3xl font-bold text-red-900 dark:text-red-200">
            {resumo.atrasado}
          </CardContent>
        </Card>
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

          <Button
            variant={apenasSemReuniaoSemana ? "default" : "outline"}
            onClick={() => setApenasSemReuniaoSemana((v) => !v)}
            className="w-full sm:w-auto"
          >
            Clientes sem reunião esta semana
          </Button>
        </div>

        <Button onClick={() => abrirAgendar()} className="w-full sm:w-auto">
          <CalendarPlus className="mr-2 size-4" />
          Nova Reunião
        </Button>
      </section>

      {/* Tabela principal */}
      <section className="rounded-lg border">
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
                  return (
                    <TableRow key={linha.cliente.cliente_nome}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {linha.cliente.cliente_nome}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {nomeConsultora(linha.cliente.consultora_id)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(linha.ultimaReuniao?.data_reuniao)}
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
                        {formatarData(linha.proximaReuniao?.data_reuniao)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {acoes.includes("ata") && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Registrar ATA recebida"
                              onClick={() => abrirAta(linha)}
                            >
                              <span aria-hidden="true">📎</span>
                              <span className="hidden lg:inline">ATA Recebida</span>
                            </Button>
                          )}
                          {acoes.includes("agendar") && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Agendar reunião"
                              onClick={() => abrirAgendar(linha.cliente.cliente_nome)}
                            >
                              <CalendarPlus className="size-4" />
                              <span className="hidden lg:inline">Agendar</span>
                            </Button>
                          )}
                          {acoes.includes("finalizar") && (
                            <Button
                              size="sm"
                              title="Finalizar reunião"
                              onClick={() => abrirFinalizar(linha)}
                            >
                              <span aria-hidden="true">✅</span>
                              <span className="hidden lg:inline">Finalizar</span>
                            </Button>
                          )}
                          {acoes.includes("ver") &&
                            (linha.ultimaReuniao?.arquivo_drive_link ? (
                              <Button size="sm" variant="outline" title="Ver arquivo final" asChild>
                                <a
                                  href={linha.ultimaReuniao.arquivo_drive_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <span aria-hidden="true">📁</span>
                                  <span className="hidden lg:inline">Ver</span>
                                </a>
                              </Button>
                            ) : (
                              <span className="self-center text-sm text-muted-foreground">-</span>
                            ))}
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
          <h2 className="text-lg font-semibold tracking-tight">Agendamentos Fixos da Semana</h2>
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

        <div className="rounded-lg border">
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
    </main>
  );
}
